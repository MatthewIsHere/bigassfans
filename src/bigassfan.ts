import * as net from "net"
import * as SLIP from "./SLIP"
import { EventEmitter } from "events"
import TypedEmitter from "typed-emitter"

import { Properties, PropertiesSchema, PropertyKey } from "./schema"
import { ApiMessage, Property as ProtoProperty, Query_Type, ScheduleJob } from "./proto/fan"
import { DEBUG, DEBUG_APIMessage } from "./logging"
import { discover } from "./discovery"


class PropertyStore
    extends EventEmitter {

    private store: Partial<Properties> = {}
    get<T extends PropertyKey>(key: T): Properties[T] | undefined {
        return this.store[key]
    }
    set<T extends PropertyKey>(key: T, value: Properties[T]): void {
        this.store[key] = value
        this.emit(key, value)
    }
    waitForChange<T extends PropertyKey>(key: T): Promise<Properties[T]> {
        return new Promise(resolve =>
            this.once(key, resolve)
        )
    }
}

type BigAssEvents = {
    online: () => void
    ready: (fan: BigAssFan) => void,
    error: (error: Error) => void
}
class BigAssDevice
    extends (EventEmitter as new () => TypedEmitter<BigAssEvents>) {

    // Online status
    public ip: string
    public port: number
    private failCount: number = 0
    protected ready: boolean = false
    protected fatal: boolean = false
    
    // For TCP Handling
    private connection: net.Socket
    private tcp_leftovers: Uint8Array | null = null
    private slip_open = false
    private slip_start: number | null = null

    // Device State
    protected properties = new PropertyStore()

    constructor(ip: string, port: number) {
        super()
        this.connection = this.createConnection(ip, port)
        this.connection.on("connect", this.onConnected.bind(this))
        this.connection.on("error", this.onError.bind(this))
        this.connection.on("data", this.onTCPChunk.bind(this))
        this.connection.on("ready", this.onReady.bind(this))

        this.ip = ip
        this.port = port
    }

    private onReady() {
        this.emit("online")
    }
    private onConnected() {
        // Send initial query for all data
        this.sendQuery(Query_Type.All)
    }
    private onError(err: Error) {
        this.failCount++
        DEBUG(err)
        if (err.name == "ECONNREFUSED") {
            this.fatalError(err.name)
        } else if (err.name == "EHOSTUNREACH") {
            this.fatalError(err.name)
        } else {
            if (this.failCount >= 2) {
                DEBUG(`BigAssDevice (${this.ip}): Has failed too may times and will now quit`)
                this.fatalError("Too Many connection erros")
            } else {
                DEBUG(`BigAssDevice (${this.ip}): Has failed and will retry`)
                this.connection = this.createConnection(this.ip, this.port)
            }
        }
    }

    private createConnection(ip: string, port: number) {
        return net.createConnection({
            host: ip,
            port: port,
            family: 4, // As far as I know, BaF is only IPv4 :(
            keepAlive: true
        })
    }
    private onTCPChunk(b: Buffer) {
        const data = Uint8Array.from(b)
        for (let i: number = 0; i < data.length; i++) {
            if (data[i] == 0xC0) {
                if (!this.slip_open) {
                    this.slip_open = true
                    this.slip_start = i
                } else {
                    if (this.slip_open === null) throw "theoretically impossible behavior"
                    if (this.slip_start === null) throw "theoretically impossible behavior"
                    let packet: Uint8Array
                    if (this.tcp_leftovers === null) {
                        packet = data.subarray(this.slip_start, i + 1)
                    } else {
                        const totalLength = this.tcp_leftovers.length + data.length
                        const combined = new Uint8Array(totalLength)
                        combined.set(this.tcp_leftovers)
                        combined.set(data, this.tcp_leftovers.length)
                        packet = combined.subarray(this.slip_start, this.tcp_leftovers.length + i + 1)
                    }

                    this.handlePacket(packet)
                    this.slip_start = null
                    this.slip_open = false
                    this.tcp_leftovers = null
                }
            }
        }
        if (this.slip_open) {
            this.tcp_leftovers = data
        }
    }
    private handlePacket(packet: Uint8Array) {
        const protodata = SLIP.unwrap(packet)
        if (protodata === null)
            return DEBUG(`failed to decode packet: ${packet}`)
        const decodedProto = ApiMessage.decode(protodata)
        this.receive(decodedProto)
    }
    private fatalError(msg: string) {
        console.log(`WARN: Fatal Error: ${msg}`)
        this.fatal = true
        this.emit("error", new Error(msg))
        this.destroy()
    }
    destroy() {
        DEBUG(`Destroying connection to ${this.connection.remoteAddress}`)
        this.ready = false
        this.connection.destroy()
    }

    // API Message Handling
    private syncAPIUpdate(properties: Partial<Properties>) {
        for (let key of Object.keys(properties)) {
            let newValue = properties[key as keyof typeof properties]
            if (newValue !== undefined) {
                this.properties.set(key as PropertyKey, newValue)
            }
        }
    }
    private receive(msg: ApiMessage) {
        DEBUG_APIMessage(msg)
        msg.inner?.update?.properties.forEach(async property => {
            let safe = await PropertiesSchema.partial().parseAsync(property)
            this.syncAPIUpdate(safe)
        })
    }
    private send(msg: ApiMessage) {
        DEBUG("Sending:")
        DEBUG(msg)
        DEBUG_APIMessage(msg)
        const protodata = ApiMessage.encode(msg)
        const buffer = protodata.finish()
        const encapsulated = SLIP.wrap(buffer)
        this.connection.write(encapsulated)
    }
    // Helper functions
    private sendQuery(type: Query_Type) {
        this.send({
            inner: {
                query: {
                    type
                }
            }
        })
    }
    private sendCommands(commands?: ProtoProperty[], scheduleJob?: ScheduleJob[]) {
        if (commands === undefined) commands = []
        if (scheduleJob === undefined) scheduleJob = []
        if (commands.length === 0 && scheduleJob.length === 0) {
            return DEBUG("No commands or jobs passed to sendCommands. Doing nothing.")
        }
        this.send({
            inner: {
                job: {
                    systemAction: undefined,
                    commands,
                    scheduleJob
                }
            }
        })
    }
    
    // High Level Property Access
    protected async get<T extends PropertyKey>(property: T): Promise<Properties[T]> {
        let current = this.properties.get(property)
        if (current === undefined)
            return this.properties.waitForChange(property)
        else
            return current
    }
    protected async set<T extends PropertyKey>(property: T, value: Properties[T]): Promise<Properties[T]> {
        if (this.properties.get(property) == value) {
            DEBUG(`BigAssDevice.set: ${property} value is same as current (${value}). Will not send packet.`)
            return value
        }
        this.sendCommands([{ [property]: value }])
        return this.properties.waitForChange(property)
    }
    
}






type If<Value extends boolean, TrueResult, FalseResult = null> = Value extends true
    ? TrueResult
    : Value extends false
    ? FalseResult
    : TrueResult | FalseResult
type AddFeature<T extends keyof DeviceCapabilities> = {
    [key in T]: true
} & DeviceCapabilities
type DeviceCapabilities = Properties["deviceCapabilities"]
function noCapabilities(): DeviceCapabilities  {
    return {
        "hasTempSensor": false,
        "hasHumiditySensor": false,
        "hasOccupancySensor": false,
        "hasLight": false,
        "hasLightSensor": false,
        "hasColorTempControl": false,
        "hasFan": false,
        "hasSpeaker": false,
        "hasPiezo": false,
        "hasLedIndicators": false,
        "hasUplight": false,
        "hasUvcLight": false,
        "hasStandbyLed": false,
        "hasEcoMode": false
    }
}


export class BigAssFan<Capabilities extends DeviceCapabilities = DeviceCapabilities>
    extends BigAssDevice {
    
    // Static Methods
    static discover = discover
    
    // You MUST include the Generic in a type somewhere, otherwise type inference does not work
    public _features: Capabilities | DeviceCapabilities = noCapabilities()
    
    constructor(ip: string, port: number) {
        super(ip, port)
        this.on("online", this.onOnline.bind(this))
    }

    // Setup capabilities and property accessors
    private async onOnline() {
        const features = await this.capabilities.get()
        this._features = features
        if (features.hasFan) this.fan = this._fan as typeof this.fan
        if (features.hasLight) this.light = this._light as typeof this.light
        if (this.hasFan() && features.hasOccupancySensor) this._fan.occupancy = this._fanOccupancy as typeof this._fan.occupancy
        if (this.hasLight() && features.hasOccupancySensor) this._light.occupancy = this._lightOccupancy as typeof this._light.occupancy
        if (this.hasLight() && features.hasColorTempControl) this._light.temperature = this._colorTemperature as typeof this.light.temperature
        if (features.hasTempSensor) this.sensors.temperature = this._temperature as typeof this.sensors.temperature
        if (features.hasHumiditySensor) this.sensors.humidity = this._humidity as typeof this.sensors.humidity
        if (features.hasEcoMode) this.eco = this._eco as typeof this.eco

        // Setup finished. We are ready.
        this.ready = true
        this.emit("ready", this)
    }

    private createProp<T extends PropertyKey>(key: T) {
        const parent = this
        let schema = PropertiesSchema.shape[key]
        type Target = Properties[T]
        return {
            async get(): Promise<Target> {
                return parent.get(key)
            },
            async set(value: Target): Promise<Target> {
                let validated = await schema.safeParseAsync(value)
                if (validated.success) {
                    let s = validated.data as Target
                    return parent.set(key, s)
                } else {
                    throw new Error("Invalid Property Value")
                }
            },
            onChange(func: (value: Target) => void) {
                parent.properties.on(key, func)
            }
        }
    }
    private createReadonlyProp<T extends PropertyKey>(key: T) {
        const parent = this
        type Target = Properties[T]
        return {
            async get(): Promise<Target> {
                return parent.get(key)
            },
            onChange(func: (value: Target) => void) {
                parent.properties.on(key, func)
            }
        }
    }
    
    // Type Guards

    hasFan(): this is BigAssFan<AddFeature<"hasFan">> {
        return this._features.hasFan
    }
    hasLight(): this is BigAssFan<AddFeature<"hasLight">> {
        return this._features.hasLight
    }
    hasColorTemperature(): this is BigAssFan<AddFeature<"hasColorTempControl"> & AddFeature<"hasLight">> {
        return this._features.hasColorTempControl && this._features.hasLight
    }
    hasOccupancy(): this is BigAssFan<AddFeature<"hasOccupancySensor">> {
        return this._features.hasOccupancySensor
    }
    hasSensors(): this is BigAssFan<AddFeature<"hasTempSensor"> & AddFeature<"hasHumiditySensor">> {
        return this._features.hasTempSensor && this._features.hasHumiditySensor
    }
    hasEco(): this is BigAssFan<AddFeature<"hasEcoMode">>{
        return this._features.hasEcoMode
    }
    hasUvc(): this is BigAssFan<AddFeature<"hasUvcLight">> {
        return this._features.hasUvcLight
    }
    

    // Fan Settings
    name = this.createReadonlyProp("name")
    model = this.createReadonlyProp("model")
    timeUtc = this.createReadonlyProp("utcTime")
    version = this.createReadonlyProp("fwVersion")
    macAddress = this.createReadonlyProp("macAddress")
    // privated so that implementors use type guards
    private capabilities = this.createReadonlyProp("deviceCapabilities")
    deviceId = this.createReadonlyProp("deviceId")
    cloudId = this.createReadonlyProp("cloudId")
    cloudServerUrl = this.createReadonlyProp("cloudServerUrl")
    network = this.createReadonlyProp("network")
    indicators = {
        visual: this.createProp("indicatorsEnabled"),
        audible: this.createProp("audibleIndicatorEnabled")
    }
    legacyIr = this.createProp("legacyIrEnabled")
    group = this.createReadonlyProp("groupContainer")

    private _fanOccupancy = {
        enabled: this.createProp("fanOccupancyEnabled"),
        timeout: this.createProp("fanOccupancyTimeout"),
        isOccupied: this.createProp("fanOccupied")
    }
    private _fan = {
        mode: this.createProp("fanMode"),
        direction: this.createProp("fanDirection"),
        speedPercent: this.createProp("fanPercent"),
        speed: this.createProp("fanSpeed"),
        whoosh: this.createProp("whooshEnabled"),
        occupancy: null as If<Capabilities["hasOccupancySensor"], typeof this._fanOccupancy>,
        comfortSense: {
            enabled: this.createProp("comfortSenseEnabled"),
            idealTemperature: this.createProp("comfortSenseIdealTemp"),
            minSpeed: this.createProp("comfortSenseMinSpeed"),
            maxSpeed: this.createProp("comfortSenseMaxSpeed"),
            heatSense: {
                enabled: this.createProp("comfortSenseHeatAssistEnabled"),
                speed: this.createProp("comfortSenseHeatAssistSpeed"),
                direction: this.createProp("comfortSenseHeatAssistDirection")
            }
        },
        commandedRpm: this.createProp("commandedRpm"),
        actualRpm: this.createProp("actualRpm")
    }
    fan =  null as If<Capabilities["hasFan"], typeof this._fan>

    private _lightOccupancy = {
        enabled: this.createProp("lightOccupancyEnabled"),
        timeout: this.createProp("lightOccupancyTimeout"),
        isOccupied: this.createProp("lightOccupied")
    }
    private _colorTemperature = this.createProp("lightColorTemperature")
    private _light = {
        mode: this.createProp("lightMode"),
        percent: this.createProp("lightPercent"),
        level: this.createProp("lightPercent"),
        temperature: null as If<Capabilities["hasColorTempControl"], typeof this._colorTemperature>,
        occupancy: null as If<Capabilities["hasOccupancySensor"], typeof this._lightOccupancy>,
        dimToWarm: this.createProp("lightDimToWarmEnabled")
    }
    light = null as If<Capabilities["hasLight"], typeof this._light>

    private _uvc = {
        enabled: this.createReadonlyProp("uvcEnabled"),
        life: this.createReadonlyProp("uvcLife")
    }
    uvc = null as If<Capabilities["hasUvcLight"], typeof this._uvc>

    private _eco = this.createProp("ecoModeEnabled")
    eco = null as If<Capabilities["hasEcoMode"], typeof this._eco>

    private _temperature = this.createReadonlyProp("temperature")
    private _humidity = this.createReadonlyProp("humidity")
    sensors = {
        temperature: null as If<Capabilities["hasTempSensor"], typeof this._temperature>,
        humidity: null as If<Capabilities["hasHumiditySensor"], typeof this._humidity>
    }

}