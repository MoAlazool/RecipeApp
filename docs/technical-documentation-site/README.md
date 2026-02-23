# Technical Documentation Website

Static website for submission-ready technical docs (tech stack, architecture, RevenueCat flow).

## Local Preview

From repository root:

```bash
npx serve docs/technical-documentation-site
```

Then open the printed local URL.

## Deploy (Vercel)

From repository root:

```bash
npx vercel docs/technical-documentation-site --prod
```

Use the generated URL as your submission documentation link.

## Deploy (Netlify Drop)

1. Open [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag folder: `docs/technical-documentation-site`
3. Copy the generated public URL.

## Files

- `index.html`: Main documentation page
- `styles.css`: Presentation layer
