import { Outlet, useLocation } from 'react-router-dom';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { Header } from './Header';
import { Footer } from './Footer';

export function Layout() {
  useScrollToTop();
  const { pathname } = useLocation();

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Header />
      <main id="main-content" key={pathname} className="page-fade">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
