import { TemplateResult } from "lit-html";
import { JSDOM } from 'jsdom'
import { parseTemplate, templateTag } from "./mangleTag";

export function mangle(getHtml: () => TemplateResult, instance: any, mangler: (root: FakeElement) => void) {
    const templated = getHtml.call(instance)
    const domish = new DOMIsh(templated)

    mangler.call(instance, domish.root)
    return domish.toTemplateResult()
}

class DOMIsh {
    template: TemplateResult
    root: FakeElement

    values: unknown[] = []

    #internalRoot: Element

    getPlaceholderForValue(value: unknown) {
        let index = this.values.indexOf(value)
        if (index === -1) {
            index = this.values.length
            this.values.push(value)
        }

        if (typeof value !== 'object' && typeof value !== 'function' && value !== undefined && value !== null) {
            return `#$$lit_mangler_${index}$$${value}/$$lit_mangler_${index}$$`
        }

        if (typeof value === 'object' && value !== null && templateTag in value) {
            return `#$$lit_mangler_${index}$$
${this.getRawHTML(value as any)}
/$$lit_mangler_${index}$$`
        }

        if (Array.isArray(value)) {
            return value.map((v, i) => `#$$lit_mangler_${index}_${i}$$
${this.getRawHTML(v as any)}
/$$lit_mangler_${index}_${i}$$`).join('')
        }

        // We use this for placeholding values which can't be represented nicely
        // in HTML, like functions, undefined, null ect.
        return `$$lit_mangler_${index}$$`
    }

    constructor(template: TemplateResult) {
        this.template = template

        const [internal, element] = this.parseFromTemplate(template)
        this.#internalRoot = internal
        this.root = element
    }

    // Note: The parsed result is wrapped in a body
    parseFromTemplate(template: TemplateResult): [HTMLElement, FakeElement] {
        const rawHTML = this.getRawHTML(template)
        const dom = new JSDOM(rawHTML)

        const node = dom.window.document.body
        return [node, new FakeElement(node, this)]
    }

    getRawHTML(template: TemplateResult): string {
        return template.strings.reduce((prev, next, currentIndex) => {
            const value = currentIndex < template.values.length
                ? this.getPlaceholderForValue(template.values[currentIndex])
                : ''
            return prev + next + value
        }, '')
    }

    #toTemplateResult(rawHTML: string): TemplateResult {
        return parseTemplate(rawHTML, this.values)
    }

    toTemplateResult(): TemplateResult {
        const rawHTML = this.#internalRoot.innerHTML
        return this.#toTemplateResult(rawHTML)
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
            // Note: We only add classes as TemplateLiterals
            add: (...tokens: StringResult[]) => {
                this.#element.classList.add(...tokens.map(t => this.domish.getPlaceholderForValue(t)))
            },

            // Note: We want to be able to remove literals from the classList or template values
            remove: (...tokens: StringResult[]) => {
                this.#element.classList.remove(...tokens.flatMap(t => [t, this.domish.getPlaceholderForValue(t)]).filter(t => typeof t === 'string'))
            },

            // If the classList contains the literal token, we'll toggle that. Otherwise,
            // toggle the template values.
            toggle: (token: StringResult) => {
                if (typeof token === 'string' && this.#element.classList.contains(token)) {
                    this.#element.classList.toggle(token)
                    return
                }
                const value = this.domish.getPlaceholderForValue(token)
                this.#element.classList.toggle(value)
            },

            // Determine if the classList contains the literal token or the template value
            contains: (token: StringResult) => {
                const value = typeof token === 'string' ? token : this.domish.getPlaceholderForValue(token)
                return typeof token === 'string' && this.#element.classList.contains(value)
                    || this.#element.classList.contains(this.domish.getPlaceholderForValue(token))
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
