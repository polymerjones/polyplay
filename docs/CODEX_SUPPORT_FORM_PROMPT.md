# Codex Prompt: Support Page Contact Form

Implement the existing Paul Fisher Media contact form on my support page using Formspree.

## Formspree details

- Endpoint: `https://formspree.io/f/xjgedvje`
- Preferred env var: `NEXT_PUBLIC_FORMSPREE_ID=xjgedvje`

## Requirements

- Add the contact form to the support page.
- Keep these fields:
  - `name`
  - `email`
  - `phone`
  - `subject`
  - `message`
- Validation:
  - require `name`
  - require `subject`
  - require `message`
  - require at least one of `email` or `phone`
- Submit with `fetch` to the Formspree endpoint using JSON.
- Request details:
  - `method: "POST"`
  - headers:
    - `"Content-Type": "application/json"`
    - `Accept: "application/json"`
- Show a success message on successful submit.
- Show an error message if submit fails.
- Disable the submit button while submitting.
- Use the site's existing design system and styling. Do not create a separate visual language.
- Prefer env-based configuration over hardcoding:

```ts
const formspreeId = process.env.NEXT_PUBLIC_FORMSPREE_ID;
const endpoint = formspreeId ? `https://formspree.io/f/${formspreeId}` : null;
```

- If the support page already has a contact section or modal, wire this form into the existing UI instead of duplicating it.
- Keep the implementation clean and production-ready.

## Minimal submit example

```ts
await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json"
  },
  body: JSON.stringify({
    name,
    email,
    phone,
    subject,
    message
  })
});
```

## Fallback option

If the page only needs a simple contact button, use:

```html
<a href="https://formspree.io/f/xjgedvje" target="_blank" rel="noopener noreferrer">
  Contact
</a>
```

## Output requested from Codex

After implementing, tell me:

1. which files were changed
2. where the env var should be added
3. any follow-up steps needed
