import { html } from "lit-html";
import { FakeElement } from "../types/element";

export function getHtml(this: FakeElement & { name: string }) {
    return html`<div class="${this.data.name} greeter">
        Hello <span>${this.name}</span>
    </div>`
}

// This one is particularly brutal 'cause we don't have a component boundary to mangle
export function getList(this: string[]) {
    return html`<div>
        Hi All!
        
        <div class="greetings">
            ${this.map(t => getHtml.call({ name: t, data: {} }))}
        </div>`
}
