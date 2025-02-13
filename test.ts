import { html, TemplateResult } from "lit-html";
import { getHtml, getList } from "./examples/basic.html";
import { mangle } from "./mangle";

const render = (t: TemplateResult) => {
    let result = t.strings[0]
    for (let i = 0; i < t.values.length; ++i) {
        let value = t.values[i]

        if (typeof value === 'function') value = value()
        if (value) {
            if (Array.isArray(value))
                value = value.map(v => ('_$litType$' in (v as any)) ? render(v as any) : v).join('')
            else if (typeof value === 'object' && '_$litType$' in value) value = render(value as any)
            result += value
        }
        result += t.strings[i + 1]
    }

    return result
}

const mangledGreeting = mangle(getHtml, {
    name: "Jay",
    data: {
        greeting: 'Hello'
    }
}, t => {
    let greetings = 0
    const s = t.querySelector('span');

    // add " and me!" after the person being greeted
    s?.appendChild(' and me!')

    // add the ".foo" class to the person/thing being greeted
    s?.setAttribute('class', 'foo')

    // add a footer with the number of greetings
    s?.parentElement?.appendChild(html`
        <footer>Greeted ${() => ++greetings} people</footer>`)
})

// console.log(mangledGreeting)
// console.log(render(mangledGreeting))


const mangledList = mangle(getList, ['jay', 'brian', 'ola', 'pete'], t => {
    // Change the title of who's being greeted
    // first child is a div
    const root = t.querySelector('div')
    root?.childNodes[0].replace(html`Greetings from The Mangler!!`)

    const jay = t.querySelectorAll('span')
    console.log(jay)
    // jay?.classList.add('best')
})

console.log(render(mangledList))
