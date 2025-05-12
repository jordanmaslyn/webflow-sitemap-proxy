import { NextRequest, NextResponse } from 'next/server';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { 
    getSourceSitemapUrl, 
    getUrlsToRemove, 
    getUrlsToAdd, 
    getDomainToReplace, 
    getOriginDomain 
} from './config'; // Adjust path if needed

export async function GET(request: NextRequest) {
    try {
        // Fetch configuration
        const [sourceSitemapUrl, urlsToRemove, urlsToAdd, domainToReplace, originDomain] = await Promise.all([
            getSourceSitemapUrl(),
            getUrlsToRemove(),
            getUrlsToAdd(),
            getDomainToReplace(),
            getOriginDomain()
        ]);

        // Fetch the original sitemap
        const response = await fetch(sourceSitemapUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch sitemap from ${sourceSitemapUrl}: ${response.statusText}`);
        }
        const xmlText = await response.text();

        // Configure the XML parser
        const parser = new XMLParser({
            ignoreAttributes: false, // Keep attributes
            attributeNamePrefix: "@_", // Default prefix for attributes
            allowBooleanAttributes: true,
            parseAttributeValue: true,
            trimValues: true,
            isArray: (name, jpath, isLeafNode, isAttribute) => {
                // Treat 'url' tags as an array even if there's only one
                if (jpath === 'urlset.url') return true;
                return false;
            }
        });

        // Parse the XML
        let sitemapObject = parser.parse(xmlText);

        // Ensure urlset and url properties exist
        if (sitemapObject.urlset && sitemapObject.urlset.url) {
            // Remove URLs if needed
            if (urlsToRemove.length > 0) {
                sitemapObject.urlset.url = sitemapObject.urlset.url.filter((entry: any) => {
                    // Use the new helper function for matching
                    return entry.loc && !urlsToRemove.some(pattern => urlMatchesPattern(entry.loc, pattern));
                });
            }

            // Add new URLs if needed
            if (urlsToAdd.length > 0) {
                sitemapObject.urlset.url = [
                    ...sitemapObject.urlset.url,
                    ...urlsToAdd.map((url: string) => ({ loc: url }))
                ];
            }

            // Replace domain if needed
            if (domainToReplace && originDomain) { // Ensure both values are present
                sitemapObject.urlset.url = sitemapObject.urlset.url.map((entry: any) => {
                    // Check if the URL is on the origin domain before replacing
                    if (entry.loc && typeof entry.loc === 'string' && entry.loc.startsWith(originDomain)) {
                        entry.loc = entry.loc.replace(originDomain, domainToReplace);
                    }
                    return entry;
                });
            }
        } else {
            console.warn('Sitemap structure might be unexpected or empty.');
            // If the structure is unexpected, return the original sitemap or an empty one
            // Returning original for now, but you might want to handle this differently
        }


        // Configure the XML builder
        const builder = new XMLBuilder({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            format: true, // Pretty print the XML
            suppressEmptyNode: true, // Remove empty nodes like <url></url> if filtering results in empty set
        });

        // Build the modified XML
        const modifiedXml = builder.build(sitemapObject);

        // Return the modified sitemap with the correct content type
        return new NextResponse(modifiedXml, {
            status: 200,
            headers: {
                // 'Content-Type': 'application/xml',
                // Optional: Add caching headers if desired
                // 'Cache-Control': 's-maxage=3600, stale-while-revalidate', // Cache for 1 hour
            },
        });
    } catch (error) {
        console.error('Error processing sitemap:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

// Helper function to test if a URL matches a pattern (exact, *, or **)
const urlMatchesPattern = (url: string, pattern: string): boolean => {
    // If the pattern doesn't contain any glob characters, perform an exact match.
    if (!pattern.includes('*') && !pattern.includes('**')) {
        return url === pattern;
    }

    let regexString = pattern;

    // Step 1: Temporarily replace glob wildcards with unique, non-regex-special placeholders.
    // Replace ** (globstar) first, as it's more encompassing and specific in its glob meaning.
    regexString = regexString.replace(/\*\*/g, '__GLOBSTAR__');
    // Replace * (wildcard) next.
    regexString = regexString.replace(/\*/g, '__WILDCARD__');

    // Step 2: Escape all standard regex special characters in the pattern.
    // This will not affect the placeholders as they are simple strings without regex special characters.
    regexString = regexString.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

    // Step 3: Convert the placeholders back to their regex equivalents.
    // __GLOBSTAR__ becomes .*, which matches any sequence of characters (including slashes).
    regexString = regexString.replace(/__GLOBSTAR__/g, '.*');
    // __WILDCARD__ becomes [^/]+, which matches any sequence of one or more characters except a slash.
    regexString = regexString.replace(/__WILDCARD__/g, '[^/]+');

    // Step 4: Anchor the regex to match the entire URL.
    const finalRegexPattern = `^${regexString}$`;

    try {
        const regex = new RegExp(finalRegexPattern);
        return regex.test(url);
    } catch (e) {
        console.error(
            `Failed to create or test regex. Original pattern: "${pattern}", Processed regex string: "${finalRegexPattern}"`,
            e
        );
        return false; // Fallback if regex is invalid
    }
};

// Opt out of caching for this dynamic route
export const dynamic = 'force-dynamic'; 