export function wrap(b: Uint8Array): Uint8Array {
    let escaped: number[] = [0xC0]
    for (let x of b) {
        if (x === 0xC0) {
            escaped.push(0xDB)
            escaped.push(0xDC)
        } else if (x === 0xDB) {
            escaped.push(0xDB)
            escaped.push(0xDD)
        } else {
            escaped.push(x)
        }
    }
    escaped.push(0xC0)
    let final = Buffer.from(escaped)
    return final
}
export function unwrap(b: Uint8Array): Uint8Array | null {
    // Ignore incorrectly wrapped data
    if (b[0] !== 0xC0 || b[b.length - 1] !== 0xC0) return null

    let unwrapped: number[] = []
    let escapeSq = false
    //Skip start and end 0xC0
    for (let x = 1; x < b.length - 1; x++) {
        if (escapeSq) {
            if (b[x] === 0xDC)
                unwrapped.push(0xC0)
            else if (b[x] === 0xDD)
                unwrapped.push(0xDB)
            else
                return null
            escapeSq = false
        } else if (b[x] === 0xDB) {
            escapeSq = true
        } else {
            unwrapped.push(b[x])
        }
    }
    return Buffer.from(unwrapped)
}