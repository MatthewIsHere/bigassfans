import { BigAssFan } from "./bigassfan"
import mDnsSd from "node-dns-sd"

interface FanDescription {
    ip: string,
    port: number,
    apiVersion: string,
    deviceId: string,
    model: string
    name: string
}
interface Initializer {
    initialize: () => BigAssFan
}

export async function discover(): Promise<(FanDescription & Initializer)[]> {
    const results = await mDnsSd.discover({
        name: "_api._tcp.local"
    })
    const descriptions = parseMDNS(results)
    return descriptions.map(description => {
        return {
            name: description.name,
            ip: description.ip,
            port: description.port,
            apiVersion: description.apiVersion,
            deviceId: description.deviceId,
            model: description.model,
            initialize: () => {
                return new BigAssFan(description.ip, description.port)
            }
        }
    })
    
}


// export async function getAdvertisingFans(): Promise<FanDescription[]> {
//     const results = await mDnsSd.discover({
//         name: "_api._tcp.local"
//     })
//     const descriptions = parseMDNS(results)
//     return descriptions
// }

function parseMDNS(responses: any): FanDescription[] {
    const descriptions: FanDescription[] = []

    responses.forEach((entry: any) => {
        if (!entry.fqdn.includes("_api._tcp.local")) return // Only continue parsing correct responses
        const txtRecord = entry.packet.answers.find((record: any) => record.type === "TXT")
        const description: FanDescription = {
            ip: entry.address,
            port: Number.parseInt(entry.service.port),
            apiVersion: txtRecord.rdata["api version"],
            deviceId: txtRecord.rdata.uuid,
            model: txtRecord.rdata.model,
            name: txtRecord.rdata.name
        }
        descriptions.push(description)
    })
    return descriptions
}