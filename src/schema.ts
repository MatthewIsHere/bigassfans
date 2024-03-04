import { z } from "zod"
import { AssistWith, Direction, ExternalDeviceType, FirmwareType, MultipleLightMode, OperatingMode, RebootReason, StandbyLed_ColorPreset, WallControlConfiguration_Function } from "./proto/fan"

export const Uint = z.number().int().nonnegative().safe()
export const Speed = Uint.max(7)
export const Percent = Uint.max(100)
const ZodUint8Array = z.custom<Uint8Array>((data: unknown) => {
    return (data instanceof Uint8Array)
})
const BytesToString = ZodUint8Array.transform(buffer => buffer.toString())

export const Version = z.object({
    "type": z.nativeEnum(FirmwareType),
    "appVersion": z.string(),
    "bootloaderVersion": z.string()
})
export const WallControlConfiguration = z.object({
    "topButtonFunction": z.nativeEnum(WallControlConfiguration_Function),
    "bottomButtonFunction": z.nativeEnum(WallControlConfiguration_Function)
})
export const ExternalDeviceVersion = z.object({
    "type": z.nativeEnum(ExternalDeviceType),
    "packageVersion": z.string(),
    "bootloaderVersion": z.string(),
    "macAddress": z.string(),
    "rebootReason": z.nativeEnum(RebootReason)
})
export const Capabilities = z.object({
    "hasTempSensor": z.boolean(),
    "hasHumiditySensor": z.boolean(),
    "hasOccupancySensor": z.boolean(),
    "hasLight": z.boolean(),
    "hasLightSensor": z.boolean(),
    "hasColorTempControl": z.boolean(),
    "hasFan": z.boolean(),
    "hasSpeaker": z.boolean(),
    "hasPiezo": z.boolean(),
    "hasLedIndicators": z.boolean(),
    "hasUplight": z.boolean(),
    "hasUvcLight": z.boolean(),
    "hasStandbyLed": z.boolean(),
    "hasEcoMode": z.boolean(),
})
export const DebugInfo = z.object({
    "uptimeMinutes": Uint,
    "rebootCountTotal": Uint,
    "rebootCountSincePor": Uint,
    "lastRebootReason": z.nativeEnum(RebootReason),
    "lastRebootDetails": Uint,
    "softwareError": Uint,
    "softwareErrorDetails": Uint
})
export const GroupContainer = z.object({
    "uuid": BytesToString,
    "name": z.string()
})
//RGB Should probably be 8 bit...
export const StandbyLed = z.object({
    "colorPreset": z.nativeEnum(StandbyLed_ColorPreset),
    "enabled": z.boolean(),
    "percent": Percent,
    "red": Uint,
    "green": Uint,
    "blue": Uint
})

export type Properties = z.infer<typeof PropertiesSchema>
export type PropertyKey = keyof Properties

export const PropertiesSchema = z.object({
    "name": z.string(),
    "model": z.string(),
    "localTime": z.string(), // Not ISO 8601 Compliant
    "utcTime": z.string().datetime(),
    "timeZone": z.string(),
    "fwVersion": z.string(),
    "macAddress": z.string(),
    "cloudId": z.string(),
    "deviceId": z.string(),
    "cloudServerUrl": z.string(),
    "apiVersion": z.string(),
    "deviceTypeId": Uint,
    "detailedVersion": Version,

    "deviceCapabilities": Capabilities,
    
    "pcbaPartNumber": z.string(),
    "pcbaRevision": z.string(),

    "fanMode": z.nativeEnum(OperatingMode),
    "fanDirection": z.nativeEnum(Direction),
    "fanPercent": Percent,
    "fanSpeed": Speed,
    "comfortSenseEnabled": z.boolean(),
    "comfortSenseIdealTemp": Uint,
    "comfortSenseMinSpeed": Speed,
    "comfortSenseMaxSpeed": Speed,
    "fanOccupancyEnabled": z.boolean(),
    "fanOccupancyTimeout": Uint,
    "fanReturnToAutoEnabled": z.boolean(),
    "fanReturnToAutoTimeout": Uint,
    "whooshEnabled": z.boolean(),
    "comfortSenseHeatAssistEnabled": z.boolean(),
    "comfortSenseHeatAssistSpeed": Speed,
    "comfortSenseHeatAssistDirection": z.nativeEnum(Direction),
    "commandedRpm": Uint,
    "actualRpm": Uint,
    "ecoModeEnabled": z.boolean(),
    "fanOccupied": z.boolean(),
    "fanOnMeansAuto": z.boolean(),

    "lightMode": z.nativeEnum(OperatingMode),
    "lightPercent": Uint,
    "lightLevel": Uint,
    "lightColorTemperature": Uint,
    "lightOccupancyEnabled": z.boolean(),
    "lightOccupancyTimeout": Uint,
    "lightReturnToAutoEnabled": z.boolean(),
    "lightReturnToAutoTimeout": Uint,
    "lightDimToWarmEnabled": z.boolean(),
    "lightColorTemperatureMin": Uint,
    "lightColorTemperatureMax": Uint,
    "multipleLightMode": z.nativeEnum(MultipleLightMode),
    "standbyLed": StandbyLed,
    "lightOccupied": z.boolean(),

    "temperature": Uint,
    "humidity": Uint,

    "fanTimerMinutes": Uint,
    "fanTimerUtcExpiration": z.number().safe(),

    "lightOnMeansAuto": z.boolean(),

    "ipAddress": BytesToString,
    "network": z.object({
        "ssid": BytesToString
    }),

    "indicatorsEnabled": z.boolean(),
    "audibleIndicatorEnabled": z.boolean(),
    "legacyIrEnabled": z.boolean(),
    "wallControlConfiguration": WallControlConfiguration,

    "assistWith": z.nativeEnum(AssistWith),

    "remoteDiscoveryEnabled": z.boolean(),
    "externalDeviceCount": Uint,
    "externalDeviceVersion": ExternalDeviceVersion,
    "bleRemoteSupported": z.boolean(),

    "debugInfo": DebugInfo,

    "groupContainer": GroupContainer,

    "uvcEnabled": z.boolean(),
    "uvcLife": Uint
})
