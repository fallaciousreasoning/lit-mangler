

import { TemplateResult } from "lit-html"

// Supports the following tags:
// 1. $$lit_mangler_{n}$$ - a literal replacement. Needed for no stringifyable values
// 2. #$$lit_mangler_{n}$$ - a tagged template literal replacement opening tag. Content between this and the closing tag will be parsed as a TemplateResult
// 3. /$$lit_mangler_{n}$$ - a tagged template literal replacement closing tag.
// 4. #$$lit_mangler_{n}$${i} - an opening tag for an item in an array
// 5. /$$lit_mangler_{n}$${i} - closing tag for an item in an array
export const placeholderRegex = /(?<prefix>\/|#)?\$\$lit_mangler_(?<id>\d+)(_(?<index>\d+))?\$\$/gm
export const templateTag = '_$litType$'

type Placeholder = {
    id: number,
    start: number,
    end: number,
} & ({
    type: 'literal'
} | {
    type: 'pair',
    valueStart: number,
    valueEnd: number,
} | {
    type: "array",
    items: Placeholder[]
})

const findNextTag = (rawHtml: string, start: number, end: number): Placeholder | null => {
    placeholderRegex.lastIndex = start
    const match = placeholderRegex.exec(rawHtml)

    if (!match) return null

    const tagEnd = match.index + match[0].length

    // Don't allow parsing outside the range of the tag.
    if (tagEnd > end) return null

    const id = parseInt(match.groups!.id)

    if (isNaN(id)) throw new Error(`Failed to parse id from ${match[0]}`)

    if (match[0].startsWith('#')) {
        // Closing tag is the same as the opening tag but starting with a slash
        const closingTag = match[0].replace('#', '/')
        const closingIndex = rawHtml.indexOf(closingTag, tagEnd)

        if (closingIndex === -1) {
            throw new Error(`Couldn't find closing tag "${closingTag}"`)
        }

        // Try and parse the arrayIndex - if this is just an object this will be NaN
        const arrayIndex = parseInt(match.groups!.index)

        // First item in an array - parse all subsequent items
        if (arrayIndex === 0) {
            let tag: Placeholder | null

            // List of items, with the first one appended
            const items: Placeholder[] = [{
                start: match.index,
                end: closingIndex + closingTag.length,
                valueStart: tagEnd,
                valueEnd: closingIndex,
                type: 'pair',
                id
            }]

            // Keep parsing tags until we find one with a different id
            while (tag = findNextTag(rawHtml, items.at(-1)!.end, end)) {
                if (tag.id !== id) break

                items.push(tag)
            }

            return {
                start: match.index,
                end: items.at(-1)!.end,
                items,
                type: 'array',
                id
            }
        }

        if (match.index >= closingIndex + closingTag.length) throw new Error(`End must be after start! ${closingTag}`)

        return {
            start: match.index,
            end: closingIndex + closingTag.length,
            valueStart: tagEnd,
            valueEnd: closingIndex,

            id,

            type: 'pair'
        }
    }

    return {
        start: match?.index,
        end: tagEnd,
        id,
        type: 'literal'
    }
}

const getPlaceholderValue = (values: unknown[], placeholder: Placeholder, rawHTML: string): unknown => {
    if (placeholder.type === 'literal') {
        return values[placeholder.id]
    }

    if (placeholder.type === 'pair') {
        return parseTemplate(rawHTML, values, placeholder.valueStart, placeholder.valueEnd)
    }

    if (placeholder.type === 'array') {
        return placeholder.items.map(p => getPlaceholderValue(values, p, rawHTML))
    }
}

export const parseTemplate = (rawHTML: string, availableValues: unknown[], start = 0, end = rawHTML.length): TemplateResult => {
    const strings: string[] = []
    const values: unknown[] = []

    let tag: Placeholder | null
    let parsedTo = start
    while (tag = findNextTag(rawHTML, parsedTo, end)) {
        strings.push(rawHTML.substring(parsedTo, tag.start))
        values.push(getPlaceholderValue(availableValues, tag, rawHTML))

        parsedTo = tag.end
    }

    strings.push(rawHTML.substring(parsedTo, end));
    (strings as any)['raw'] = [...strings]
    
    return {
        strings: strings as any,
        values,
        _$litType$: 1
    }
}
