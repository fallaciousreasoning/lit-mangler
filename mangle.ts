import { TemplateResult } from "lit-html";
import { JSDOM } from 'jsdom'

export function mangle(getHtml: () => TemplateResult, instance: any, mangler: (root: FakeElement) => void) {
    const templated = getHtml.call(instance)
    const domish = new DOMIsh(templated)

    mangler.call(instance, domish.root)
    return domish.toTemplateResult()
}

const getPlaceholder = (n: number) => `$$lit_mangler_${n}$$`
const placeholderRegex = /\$\$lit_mangler_(\d+)\$\$/gm
// const parser = new DOMParser()

class DOMIsh {
    template: TemplateResult
    root: FakeElement

    values: unknown[]

    #internalRoot: Element

    getPlaceholderForValue(value: unknown) {
        let index = this.values.indexOf(value)
        if (index === -1) {
            index = this.values.length
            this.values.push(value)
        }

        return getPlaceholder(index)
    }

    getPlaceholderValue(name: string) {
        const index = placeholderRegex.exec(name)?.[1]
        return index ? this.values[parseInt(index)] : null
    }

    constructor(template: TemplateResult) {
        this.template = template
        this.values = template.values

        const rawHTML = this.template.strings.reduce((prev, next, currentIndex) => prev + next + (currentIndex < this.template.values.length ? getPlaceholder(currentIndex) : ''), "")
        const dom = new JSDOM(rawHTML)
        this.#internalRoot = dom.window.document.body
        this.root = new FakeElement(this.#internalRoot, this)
    }

    toTemplateResult(): TemplateResult {
        const rawHTML = this.#internalRoot.innerHTML

        const strings: string[] = []
        const values: unknown[] = []
        let lastIndex = 0

        for (const match of rawHTML.matchAll(placeholderRegex)) {
            // Push the raw string
            strings.push(rawHTML.substring(lastIndex, match.index))

            // Push the interpolated value
            values.push(this.values[parseInt(match[1])])

            lastIndex = match.index + match[0].length
        }

        // Push the last string
        strings.push(rawHTML.substring(lastIndex, rawHTML.length))

        return {
            _$litType$: this.template._$litType$,
            values,
            strings: {
                ...strings,
                raw: strings
            }
        }
    }

    toString() {
        // TODO: I think we should output toStringed output here
        return this.#internalRoot.innerHTML
    }
}

type StringResult = string | false | undefined | null | number | (() => string | false | undefined | null | number)
type NodeResult = string | false | undefined | null | number | TemplateResult
    | (() => string | false | undefined | null | number | TemplateResult)

class FakeNode {
    get parentNode() {
        return this.#node.parentNode && new FakeNode(this.#node.parentNode, this.domish)
    }

    get parentElement() {
        return this.#node.parentElement && new FakeElement(this.#node.parentElement, this.domish)
    }

    get textContent(): string | null {
        return this.#node.textContent
    }

    set textContent(value: StringResult) {
        const replacement = this.domish.getPlaceholderForValue(value)
        this.#node.textContent = replacement
    }

    get childNodes() {
        return Array.from(this.#node.childNodes).map(n => new FakeNode(n, this.domish))
    }

    #node: Node
    protected domish: DOMIsh

    constructor(node: Node, domish: DOMIsh) {
        this.#node = node
        this.domish = domish
    }

    remove() {
        this.#node.parentNode?.removeChild(this.#node)
    }

    replace(node: NodeResult) {
        const replacement = this.domish.getPlaceholderForValue(node)
        const textNode = this.#node.ownerDocument!.createTextNode(replacement)

        this.#node.parentNode?.replaceChild(textNode, this.#node)
    }

    insertBefore(node: NodeResult) {
        const replacement = this.domish.getPlaceholderForValue(node)
        const textNode = this.#node.ownerDocument!.createTextNode(replacement)

        this.#node.parentNode?.insertBefore(textNode, this.#node)
    }

    insertAfter(node: NodeResult) {
        const replacement = this.domish.getPlaceholderForValue(node)
        const textNode = this.#node.ownerDocument!.createTextNode(replacement)

        const nextSibling = this.#node.nextSibling
        if (nextSibling) {
            this.#node.parentNode?.insertBefore(textNode, nextSibling)
        } else {
            this.#node.parentNode?.append(textNode)
        }
    }
}

class FakeElement extends FakeNode {
    get classList() {
        return {
            add: (...tokens: StringResult[]) => {
                this.#element.classList.add(...tokens.flatMap(t => [t, this.domish.getPlaceholderForValue(t)]).filter(t => typeof t === 'string'))
            },

            remove: (...tokens: StringResult[]) => {
                this.#element.classList.remove(...tokens.flatMap(t => [t, this.domish.getPlaceholderForValue(t)]).filter(t => typeof t === 'string'))
            },

            toggle: (token: StringResult) => {
                const value = typeof token === 'string' ? token : this.domish.getPlaceholderForValue(token)
                this.#element.classList.toggle(value)
            },

            contains: (token: StringResult) => {
                const value = typeof token === 'string' ? token : this.domish.getPlaceholderForValue(token)
                return this.#element.classList.contains(value)
            }
        }
    }

    get children() {
        return Array.from(this.#element.children).map(c => new FakeElement(c, this.domish))
    }

    #element: Element

    constructor(element: Element, domish: DOMIsh) {
        super(element, domish)

        this.#element = element
    }

    querySelector(selector: string): FakeElement | null {
        const result = this.#element.querySelector(selector)
        return result && new FakeElement(result, this.domish)
    }

    querySelectorAll(selector: string): FakeElement[] {
        console.log(this.#element.outerHTML)
        console.log(this.#element.querySelectorAll(selector))
        return Array.from(this.#element.querySelectorAll(selector)).map(e => new FakeElement(e, this.domish))
    }

    setAttribute(name: string, value: StringResult) {
        const placeholder = this.domish.getPlaceholderForValue(value)
        this.#element.setAttribute(name, placeholder)
    }

    getAttribute(name: string) {
        return this.#element.getAttribute(name)
    }

    remove() {
        this.#element.remove()
    }

    appendChild(child: NodeResult) {
        const placeholder = this.domish.getPlaceholderForValue(child)
        this.#element.innerHTML += placeholder
    }
}
