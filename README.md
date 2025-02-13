# Lit Mangler

The goal of this repository is to devise an ergonomic way (and ideally
performant) way to override (mangle) `lit-html` templates.

The purpose of this is to introduce an easy way to convert our Polymer overrides
to LitElement as upstream migrates over.

## Goals

1. It should be able to replace bits of the Lit template with Lit's `html`
template tag.
2. It should be possible to tweak the internal HTML via a DOM like API (i.e.
`querySelector`, `setAttribute` `remove` ect).
3. Ideally this should run once per element (even better at build time). A first
step might run per instance of a component.
4. It should be easy to convert over our existing overrides in `brave-core`.
5. It should break when upstream changes their HTML/CSS/Typescript such that
the override no longer applies.
