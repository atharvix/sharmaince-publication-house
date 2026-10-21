import type { ReactNode } from 'react';
import type { PolicySection } from '../components/layout/PolicyLayout';
import type { CmsPage } from './catalogue';

/** Turns admin-authored plain text into paragraphs — never raw HTML, so CMS copy can't inject markup. */
export function cmsRichText(text: string): ReactNode {
  const paragraphs = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (paragraphs.length <= 1) return <p>{text}</p>;
  return (
    <>
      {paragraphs.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </>
  );
}

export function cmsSections(page: CmsPage): PolicySection[] {
  return page.sections.map((section, index) => ({
    id: slugify(section.heading) || `section-${index}`,
    heading: section.heading,
    body: cmsRichText(section.body),
  }));
}

export function formatCmsDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
