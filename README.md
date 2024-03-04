# BigAssFans
## A Typesafe Wrapper API To Control BigAssProducts (Unofficial)

This library provides BigAssFan discovery (via mdns-sd), ProtoBuf wrapper classes compatible with any model and *most* available settings, asyncronous operation, and live updates as state is changed from any input.

### Features
* Discover available fans on network
* Turn fan and/or light(s) on or off
* Change speed, and direction (Keep in mind Big Ass Fans discourages reversing speed.)
* Change brightness level of LED light.
* Control UV-C light
* Exposes Motion Sensors
* Display the fan's temperature sensors (Haiku Fans).
* Turn Whoosh Mode on or off.

### Installation
```
npm install bigassfan.js
```

### Usage
#### Discovery
Using BigAssFan.discover() returns an array of a description of each fan and an initializer that opens a TCP connection.
```
import { BigAssFan } from "bigassfans"

const fans = await BigAssFan.discovery()

const result = fans.find(fan => fan.name === "Master Bedroom Fan")
if (!result) {
	const myFan: BigAssFan = result.initialize()
}
```
#### BigAssFan
**Events**

* Online: () => void
* Ready: (fan: BigAssFan) => void

When this event is emitted, the fan is ready and its capabilities are known. Use the provided HasXXX functions to access model specific properties.

**Type Guards**

```public hasFan()``` allows access to this.fan properties

```public hasLight()``` allows access to this.light properties

```public hasColorTemperature()``` allows access to the this.light.temperature property. Implies this.hasLight.

```public hasOccupancy()``` opens up this.fan.occupancy and this.light.occupancy accessors.

```public hasSensors()``` opens up this.sensors.

```public hasEco()``` reveals accessor for this.eco.

```public hasUvc()``` reveals accessor for Ultraviolet light this.uvc properties.

**Properties (Kinda methods too)**
```
ip: string
port: number

// Subsequent Properties are accessed using async .get and .set 
// functions and are bound by Zod type checking for min and max
// values and API safety

name: string
model: string
timeUtc: string // ISO 8601
version: string
macAddress: string,
deviceId: string
cloudId: string
cloudServerUrl: string
network: { ssid: string }
indicators: { visual: boolean, audible: boolean }
legacyIr: boolean
group: { name: string, uuid: string }

// If validated by hasFan()
fan: {
	mode: OperatingMode,
	direction: Direction,
	speedPercent: number,
	speed: number,
	whoosh: boolean,
	// If validated by hasOccupancy()
	occupancy: {
		enabled: boolean,
		timeout: number,
	},
	confortSense: {
		enabled: boolean,
		idealTemperature: number,
		minSpeed: number,
		maxSpeed: number,
		heatSense: {
			enabled: boolean,
			timeout: number,
			direction: Direction
		}
	}
	commandedRpm: number,
	actualRpm: number
}

// If validated by hasLight()
light: {
	mode: OperatingMode,
	percent: number,
	level: number,
	// If validated by hasColorTemperature()
	temperature: number,
	// If validated by hasOccupancy()
	occupancy: {
		enabled: boolean,
		timeout: number
	},
	dimToWarm: boolean
}

// If validated by hasUvc()
uvc: {
	enabled: boolean,
	life: number
}

// If validated by hasEco()
eco: boolean

// If validated by hasSensors()
sensors: {
	temperature: number,
	humidity: number
}
```

### Contributing
I welcome anyone to submit PRs and comment on my code - I know it needs definite improvement, especially for debugging and API usage experience.

### Acknowledgements

Huge thanks to Oogje for putting in massive work and time into homebridge-i6 for BigAssFans. He was the pioneer in bringing the i6 communication protocol to life. 
More thanks to Jfroy's implementation for pointing out the Protobuf usage and Serial Line IP encapsulation. While my goal in completing this project was to reverse engineer the language of the fan, your work significaly sped up my comprehension of the protocol.

Finally, @StinkierMcGee somehow discovered a perfect ProtoBuf schema to decode the BigAssFan language. I am suspicious of his means of obtaining it, but my implementation is copied from his forum post. 

I don't wish to compete with any other library, but I like to build stuff to learn about TypeScript programming and make cool things.



