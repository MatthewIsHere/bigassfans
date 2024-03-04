export interface FanServiceDescription {
    displayName: string
    identifier: string // modelName
    ip: string // address
    familyName: string | undefined // Not implemented or unused?
    uuid: string // Not sure if needed
    port: number // Totally unnecessary but what if it changes...
    protocol: "tcp" | "udp" // Totally unnecessary but what if it changes...
    model: FanModel
    apiVersion: number
}

export type FanModel = string // To be specified later

export interface FanConnection {
    ip: string,
    port: number,
    protocol: "tcp" | "udp"
    apiVersion: number
}