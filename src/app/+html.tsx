import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { ReactNode } from 'react';

import { pipBrand } from '@/brand/pip-brand';

export default function RootHtml({ children }: { children: ReactNode }) {
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="description" content={pipBrand.primaryTagline} />
        <meta property="og:title" content={`${pipBrand.name} — ${pipBrand.primaryTagline}`} />
        <meta property="og:description" content={pipBrand.primaryTagline} />
        <meta property="og:image" content="/pip-preview.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="apple-touch-icon" href="/pip-icon.png" />
        <link rel="preload" as="image" href="/pip-symbol.png" />
        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
