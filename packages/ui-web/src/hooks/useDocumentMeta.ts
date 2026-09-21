import { useEffect } from "react";

export interface DocumentMetaOpenGraph {
  readonly title?: string;
  readonly description?: string;
  readonly image?: string;
  readonly url?: string;
  readonly type?: string;
  readonly siteName?: string;
}

export interface DocumentMeta {
  readonly title?: string;
  readonly description?: string;
  readonly canonical?: string;
  readonly noindex?: boolean;
  readonly og?: DocumentMetaOpenGraph;
}

type Restore = () => void;

function setTag(
  tagName: "meta" | "link",
  keyAttribute: "name" | "property" | "rel",
  key: string,
  valueAttribute: "content" | "href",
  value: string,
): Restore {
  const existing = Array.from(document.head.querySelectorAll(tagName)).find(
    (node) => node.getAttribute(keyAttribute) === key,
  );

  if (existing !== undefined) {
    const previous = existing.getAttribute(valueAttribute);

    existing.setAttribute(valueAttribute, value);

    return () => {
      if (previous === null) existing.removeAttribute(valueAttribute);
      else existing.setAttribute(valueAttribute, previous);
    };
  }

  const created = document.createElement(tagName);

  created.setAttribute(keyAttribute, key);
  created.setAttribute(valueAttribute, value);
  document.head.appendChild(created);

  return () => {
    created.remove();
  };
}

const OG_KEYS: Record<keyof DocumentMetaOpenGraph, string> = {
  title: "og:title",
  description: "og:description",
  image: "og:image",
  url: "og:url",
  type: "og:type",
  siteName: "og:site_name",
};

/** Sets the document title and head tags for the mounted route, and puts back what was there on unmount. */
export function useDocumentMeta(meta: DocumentMeta): void {
  const { title, description, canonical, noindex = false, og } = meta;
  const ogTitle = og?.title;
  const ogDescription = og?.description;
  const ogImage = og?.image;
  const ogUrl = og?.url;
  const ogType = og?.type;
  const ogSiteName = og?.siteName;

  useEffect(() => {
    const restores: Restore[] = [];

    if (title !== undefined) {
      const previous = document.title;

      document.title = title;
      restores.push(() => {
        document.title = previous;
      });
    }

    if (description !== undefined)
      restores.push(
        setTag("meta", "name", "description", "content", description),
      );

    if (canonical !== undefined)
      restores.push(setTag("link", "rel", "canonical", "href", canonical));

    if (noindex)
      restores.push(
        setTag("meta", "name", "robots", "content", "noindex, nofollow"),
      );

    const openGraph: DocumentMetaOpenGraph = {
      ...(ogTitle === undefined && title === undefined
        ? {}
        : { title: ogTitle ?? title }),
      ...(ogDescription === undefined && description === undefined
        ? {}
        : { description: ogDescription ?? description }),
      ...(ogImage === undefined ? {} : { image: ogImage }),
      ...(ogUrl === undefined && canonical === undefined
        ? {}
        : { url: ogUrl ?? canonical }),
      ...(ogType === undefined ? {} : { type: ogType }),
      ...(ogSiteName === undefined ? {} : { siteName: ogSiteName }),
    } as DocumentMetaOpenGraph;

    for (const key of Object.keys(openGraph) as (keyof DocumentMetaOpenGraph)[]) {
      const value = openGraph[key];

      if (value !== undefined)
        restores.push(setTag("meta", "property", OG_KEYS[key], "content", value));
    }

    return () => {
      for (const restore of restores.reverse()) restore();
    };
  }, [
    title,
    description,
    canonical,
    noindex,
    ogTitle,
    ogDescription,
    ogImage,
    ogUrl,
    ogType,
    ogSiteName,
  ]);
}
