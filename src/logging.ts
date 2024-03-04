import { inspect } from "util"
import * as proto from "./proto/fan"

export function type(indents: number, content: any) {
    let indent = ""
    for (let i = 0; i < indents; i++) {
        indent += "    "
    }

    let final: string = indent;
    let stringified = content.toString()
    for (let i = 0; i < stringified.length; i++) {
        let letter = stringified.charAt(i)
        if (stringified.charCodeAt(i) !== 0x0A) {
            final += letter
        } else {
            final += "\n"
            final += indent
        }
    }
    console.log(final)
}

export function printAPIMessage(msg: proto.ApiMessage) {
    type(0, "API Message")
    if (msg.inner?.job !== undefined) {
        type(1, "Type: Job")
    } else if (msg.inner?.query !== undefined) {
        type(1, "Type: Query")
    } else if (msg.inner?.update !== undefined) {
        // Update Type Code
        type(1, "Type: Update")
        type(2, "Properties:")
        if (msg.inner.update.properties.length == 0) {
            type(3, "None")
        } else {
            msg.inner.update.properties.forEach(p => printProperty(2, p))
        }
        if (msg.inner.update.scheduleJob !== undefined) {
            type(2, "Schedules:")
            type(3, inspect(msg.inner.update.scheduleJob, { depth: null }))
        }
    }

    interface IIndexable {
        [key: string]: any;
    }
    function printProperty(indents: number, property: proto.Property) {
        let p = property as IIndexable
        for (let key of Object.keys(property)) {
            if (p[key] !== undefined) {
                type(indents, `${key}: ${inspect(p[key], { depth: null })}`)
            }
        }
    }
}

export function DEBUG_APIMessage(m: proto.ApiMessage) {
    if (process.env.DEBUG === "1") {
        console.log("Debug:")
        printAPIMessage(m)
    }
}
export function DEBUG(msg: any) {
    if (process.env.DEBUG === "1") {
        console.log("Debug: " + inspect(msg, { depth: null }))
    }
}