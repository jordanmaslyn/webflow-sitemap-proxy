/**
 * Configuration settings for the sitemap proxy.
 */

// Using async functions allows fetching config from external sources later if needed.

const urlsToRemove: string[] = [
    "/work/*"
];

const urlsToAdd: string[] = [
    "/work/project-2"
];

const newSitemapDomain: string = "";

export async function getUrlsToRemove(): Promise<string[]> {
    const origin = process.env.ORIGIN_DOMAIN || ''; // Use empty string if not set to avoid 'undefined' in patterns

    if (!origin) {
        throw new Error('ORIGIN_DOMAIN environment variable is not set and no fallback provided.');
    }

    return urlsToRemove.map(url => `${origin}${url}`);
}

export async function getUrlsToAdd(): Promise<string[]> {
    const origin = await getOriginDomain();
    // Add the full URLs you want to add here
    return urlsToAdd.map(url => `${url.startsWith("http") ? "" : origin}${url}`);
}

export async function getDomainToReplace(): Promise<string> {
    // NOTE: Return empty string if no domain replacement is needed
    return newSitemapDomain; // e.g. 'https://www.newdomain.com'
}

export async function getSourceSitemapUrl(): Promise<string> {
    const url = process.env.ORIGIN_DOMAIN ? `${process.env.ORIGIN_DOMAIN}/sitemap.xml` : null; // Fallback if env var not set

    if (!url) {
        throw new Error('ORIGIN_DOMAIN environment variable is not set and no fallback provided.');
    }

    return url;
}

export async function getOriginDomain(): Promise<string> {
    const origin = process.env.ORIGIN_DOMAIN;
    if (!origin) {
        console.warn('ORIGIN_DOMAIN environment variable is not set.');
        return ''; // Or throw an error if it's strictly required
    }
    return origin;
} 