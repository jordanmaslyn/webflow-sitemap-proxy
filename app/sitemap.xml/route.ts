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
    if (pattern.includes('**')) {
        // Escape regex special characters first, then convert ** to .*
        // Need to escape everything properly, including potential existing regex chars in the pattern base
        const regexPattern = pattern
            .replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&') // Escape standard regex chars
            .replace(/\\\*\\\*/g, '.*'); // Replace literal '**' with '.*' (match anything)
        return new RegExp(`^${regexPattern}$`).test(url);
    } else if (pattern.includes('*')) {
        // Escape regex special characters first, then convert * to [^/]+
        // Need to escape everything properly
        const regexPattern = pattern
            .replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&') // Escape standard regex chars
            .replace(/\\\*/g, '[^/]+'); // Replace literal '*' with '[^/]+' (match segment)
        return new RegExp(`^${regexPattern}$`).test(url);
    }
    // Exact match
    return pattern === url;
};

// Opt out of caching for this dynamic route
export const dynamic = 'force-dynamic'; 