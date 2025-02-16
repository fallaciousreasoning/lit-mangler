import { html } from "lit-html";
import { FakeElement } from "../types/element";

export function getHtml(this: FakeElement & { name: string }) {
    return html`<div class="${this.data.name} greeter">
        Hello <span>${this.name}</span>
    </div>`
}

// This one is particularly brutal 'cause we don't have a component boundary to mangle
export function getList(this: string[]) {
    const haxor = 'whatevs" onload="javascript:alert(`pwnd`)'
    return html`<div ?hidden   = ${this.length === 0 && "foo"} .count=${this.length} @click=${console.log} data-haxor='${haxor}'>
        Hi All!

        Greetings could be: ${["Hi", 'Kiora', 'Gidday'].map(g => html`<b>${g}</b>`).join('\n')}
        
        <div class="greetings count-${this.length}">
            ${this.map(t => getHtml.call({ name: t, data: {} }))}
        </div>
    </div>`
}
