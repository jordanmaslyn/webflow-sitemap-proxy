import { NextRequest, NextResponse } from 'next/server';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

// Define the URLs to remove from the sitemap
const urlsToRemove: string[] = [
  // Add the full URLs you want to remove here, e.g.,
  `${process.env.ORIGIN_DOMAIN}/work/project-2`,
  `${process.env.ORIGIN_DOMAIN}/work/project-3`,
];

// The URL of the original Webflow sitemap
const SOURCE_SITEMAP_URL = `${process.env.ORIGIN_DOMAIN}/sitemap.xml`;

export async function GET(request: NextRequest) {
  try {
    // Fetch the original sitemap
    const response = await fetch(SOURCE_SITEMAP_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch sitemap: ${response.statusText}`);
    }
    const xmlText = await response.text();

    // Configure the XML parser
    const parser = new XMLParser({
      ignoreAttributes: false, // Keep attributes
      attributeNamePrefix : "@_", // Default prefix for attributes
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
      // Filter out the URLs specified in urlsToRemove
      sitemapObject.urlset.url = sitemapObject.urlset.url.filter((entry: any) => {
        return entry.loc && !urlsToRemove.includes(entry.loc);
      });
    } else {
      console.warn('Sitemap structure might be unexpected or empty.');
      // If the structure is unexpected, return the original sitemap or an empty one
      // Returning original for now, but you might want to handle this differently
    }


    // Configure the XML builder
    const builder = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix : "@_",
        format: true, // Pretty print the XML
        suppressEmptyNode: true, // Remove empty nodes like <url></url> if filtering results in empty set
    });

    // Build the modified XML
    const modifiedXml = builder.build(sitemapObject);

    // Return the modified sitemap with the correct content type
    return new NextResponse(modifiedXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        // Optional: Add caching headers if desired
        // 'Cache-Control': 's-maxage=3600, stale-while-revalidate', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error processing sitemap:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Opt out of caching for this dynamic route
export const dynamic = 'force-dynamic'; 