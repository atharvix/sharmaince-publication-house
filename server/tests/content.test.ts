import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

async function loginAs(email: string, password: string) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.accessToken as string;
}

function uniqueSlug() {
  return `test-page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe('CMS static page publishing', () => {
  it('404s for a slug with no content page', async () => {
    const res = await request(app).get(`/api/content/pages/${uniqueSlug()}`);
    expect(res.status).toBe(404);
  });

  it('a draft page (isPublished: false) is not visible publicly but is visible to admin', async () => {
    const slug = uniqueSlug();
    const token = await loginAs('admin@nightingalepress.example', 'Admin123!');

    const put = await request(app)
      .put(`/api/admin/content/pages/${slug}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Draft Page', intro: 'Draft intro', sections: [{ heading: 'H1', body: 'B1' }], isPublished: false });
    expect(put.status).toBe(200);
    expect(put.body.page.isPublished).toBe(false);

    const publicRes = await request(app).get(`/api/content/pages/${slug}`);
    expect(publicRes.status).toBe(404);

    const adminList = await request(app).get('/api/admin/content/pages').set('Authorization', `Bearer ${token}`);
    expect(adminList.status).toBe(200);
    expect(adminList.body.items.some((p: { slug: string }) => p.slug === slug)).toBe(true);
  });

  it('a published page is visible publicly with the expected shape and no internal fields', async () => {
    const slug = uniqueSlug();
    const token = await loginAs('admin@nightingalepress.example', 'Admin123!');

    await request(app)
      .put(`/api/admin/content/pages/${slug}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Live Page', intro: 'Live intro', sections: [{ heading: 'H1', body: 'B1' }], isPublished: true });

    const res = await request(app).get(`/api/content/pages/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.page).toMatchObject({ slug, title: 'Live Page', intro: 'Live intro', sections: [{ heading: 'H1', body: 'B1' }] });
    expect(typeof res.body.page.updatedAt).toBe('string');
    expect(res.body.page.updatedByUserId).toBeUndefined();
  });

  it('unpublishing a previously published page hides it again', async () => {
    const slug = uniqueSlug();
    const token = await loginAs('admin@nightingalepress.example', 'Admin123!');

    await request(app)
      .put(`/api/admin/content/pages/${slug}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Toggle Page', sections: [], isPublished: true });
    expect((await request(app).get(`/api/content/pages/${slug}`)).status).toBe(200);

    await request(app)
      .put(`/api/admin/content/pages/${slug}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Toggle Page', sections: [], isPublished: false });
    expect((await request(app).get(`/api/content/pages/${slug}`)).status).toBe(404);
  });

  it('staff can manage content pages, unauthenticated requests cannot', async () => {
    const slug = uniqueSlug();
    const staffToken = await loginAs('staff@nightingalepress.example', 'Staff123!');

    const put = await request(app)
      .put(`/api/admin/content/pages/${slug}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ title: 'Staff Page', sections: [], isPublished: true });
    expect(put.status).toBe(200);

    const unauth = await request(app).put(`/api/admin/content/pages/${slug}`).send({ title: 'x', sections: [] });
    expect(unauth.status).toBe(401);
  });
});
