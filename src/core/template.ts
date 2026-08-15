import type {RenderedTemplate, TemplateContext} from "../types";

const TABSTOP_PATTERN = /\$(\d+)|\$\{(\d+):([^}]*)\}/g;
const CONTEXT_PATTERN = /\[\[(selection|\d+|[A-Za-z_$][\w$]*)]]/gi;

function resolveContext(value: string, context: TemplateContext): string {
    return value.replace(CONTEXT_PATTERN, (_match, name: string) => {
        if (name.toLowerCase() === "selection") return context.selection ?? "";
        if (/^\d+$/.test(name)) return context.captures?.[Number(name)] ?? "";
        return context.namedCaptures?.[name] ?? "";
    });
}

export function renderTemplate(template: string, context: TemplateContext = {}): RenderedTemplate {
    let text = "";
    let cursor = 0;
    const tabstops: RenderedTemplate["tabstops"] = [];

    for (const match of template.matchAll(TABSTOP_PATTERN)) {
        const offset = match.index ?? 0;
        text += resolveContext(template.slice(cursor, offset), context);
        const index = Number(match[1] ?? match[2]);
        const placeholder = resolveContext(match[3] ?? "", context);
        const from = text.length;
        text += placeholder;
        tabstops.push({index, from, to: text.length});
        cursor = offset + match[0].length;
    }
    text += resolveContext(template.slice(cursor), context);
    tabstops.sort((a, b) => a.index - b.index || a.from - b.from);
    return {text, tabstops};
}
