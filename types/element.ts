type ActablePrefixes = `on` | 'get' | 'set' | 'show'

export class FakeElement {
    data: {
        [key: string]: any
    } = {}
}

const proxy = new Proxy({}, {
    get(target, property) {
    }
})
