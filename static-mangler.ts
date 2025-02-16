import { JSDOM } from 'jsdom'

import { readFileSync, writeFileSync } from 'fs'

interface Template {
    tag?: string,
    rawText: string,
    id: number,
    startIndex: number,
    endIndex: number,

    subtemplates: Template[]
}

interface Result {
    text: string,
    templates: Template[]
}

let nextId = 1

function* readTags(text: string): Iterable<Template> {
    let i = 0
    const stack: Pick<Template, 'id' | 'startIndex' | 'tag' | 'subtemplates'>[] = []
    const consumeUntilMatch = () => {
        i = text.indexOf(text[i], i + 1)
    }

    for (; i < text.length; ++i) {
        const isInTemplate = stack.length !== 0
        const char = text.at(i)

        // If we're not in a template and we did a string, read till the end
        if (!isInTemplate && (char == `"` || char === `'`)) {
            consumeUntilMatch()
            continue
        }

        // We're only really interested in backticks
        if (char !== '`') continue

        // This backtick is a literal, so ignore it
        if (text[i - 1] === '\\') continue

        // This is the start of an HTML template literal
        if (text.substring(i - 4, i) === 'html') {
            stack.push({
                tag: 'html',
                id: nextId++,
                startIndex: i,
                subtemplates: []
            })
            continue
        }

        // This must be an end tag!
        const templateStart = stack.pop()!
        if (!templateStart) throw new Error(`Encountered close tag without open at ${i}`)

        const template: Template = {
            ...templateStart,
            endIndex: i,
            rawText: text.substring(templateStart.startIndex + 1, i)
        }
        if (stack.length) {
            stack.at(-1)?.subtemplates.push(template)
            continue;
        }
        yield template
    }
}

const setTemplatePlaceholders = (text: string, templates: Template[]) => {
    for (const template of templates.reverse()) {
        const original = template.rawText
        template.rawText = setTemplatePlaceholders(template.rawText, template.subtemplates)
        text = text.replace(original, `$$$$lit_mangler_${template.id}$$$$`)
    }
    return text
}

const replacePlaceholders = (text: string, templates: Template[]) => {
    for (const template of templates) {
        template.rawText = replacePlaceholders(template.rawText, template.subtemplates)
        text = text.replaceAll(`$$lit_mangler_${template.id}$$`, template.rawText)
    }

    return text
}

export const loadRaw = (path: string): Result => {
    const text = readFileSync(path, 'utf-8')
        .replaceAll(/(\w+)(\s+)?=(\s+)?(\$\{.*?\})(\s|>)/gi, "$1='$4'$5")

    console.log(text)

    const templates = [...readTags(text)]
    const modifiedText = setTemplatePlaceholders(text, templates)

    return {
        text: modifiedText,
        templates: templates
    }
}

export const write = (file: string, result: Result) => {
    const text = replacePlaceholders(result.text, result.templates)
    writeFileSync(file, text)
}

export const mangle = (template: Template, mangler: (element: DocumentFragment) => void) => {
    const world = new JSDOM()
    const document = world.window.document
    const element = document.createElement('template')
    element.innerHTML = template.rawText

    mangler(element.content)

    template.rawText = element.innerHTML
        .replaceAll('&gt;', '>')
        .replaceAll('&lt;', '<')
}

const input = loadRaw('./examples/basic.html.ts')
mangle(input.templates[0], e => {
    e.querySelector('div')?.removeAttribute('?hidden')
})
write('out/basic.html.ts', input)
