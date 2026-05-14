/**
 * AniStream SPA Router & Utils
 */

const app = document.getElementById('app');

// Toast Notification System
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// API Fetch Wrapper
export async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const result = await res.json();
    if (!result.ok) throw new Error(result.error || 'Request failed');
    return result.data;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

// Router
const routes = {
  '/': { file: 'home.html', title: 'Home' },
  '/search': { file: 'search.html', title: 'Search' },
  '/anime': { file: 'anime.html', title: 'Anime' },
  '/mylist': { file: 'mallist.html', title: 'My List' },
  '/downloads': { file: 'downloads.html', title: 'Downloads' },
  '/history': { file: 'history.html', title: 'History' },
  '/settings': { file: 'settings.html', title: 'Settings' },
  '/player': { file: 'player.html', title: 'Player' }
};

async function navigate(url) {
  const path = url.split('?')[0];
  const params = new URLSearchParams(url.split('?')[1] || '');
  
  // Handle dynamic routes like /anime/:id
  let route = routes[path];
  if (!route && path.startsWith('/anime/')) {
    route = routes['/anime'];
  }

  if (!route) {
    app.innerHTML = '<h1>404 Page Not Found</h1>';
    return;
  }

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === path);
  });

  // Load page content
  try {
    const response = await fetch(`/pages/${route.file}`);
    const html = await response.text();
    
    // innerHTML doesn't execute scripts. We need to manually handle them.
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Clear and inject non-script content
    app.innerHTML = '';
    Array.from(temp.childNodes).forEach(node => {
      if (node.tagName !== 'SCRIPT') {
        app.appendChild(node.cloneNode(true));
      }
    });

    // Manually execute scripts sequentially
    const scripts = Array.from(temp.querySelectorAll('script'));
    for (const oldScript of scripts) {
      await new Promise((resolve) => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        newScript.textContent = oldScript.textContent;
        
        if (newScript.src) {
          newScript.onload = () => resolve();
          newScript.onerror = () => resolve();
          document.body.appendChild(newScript);
        } else {
          document.body.appendChild(newScript);
          newScript.remove();
          resolve();
        }
      });
    }

    document.title = `${route.title} — AniStream`;
    
    // Execute page-specific init
    window.dispatchEvent(new CustomEvent('page-load', { detail: { path, params } }));
  } catch (err) {
    console.error(err);
    showToast('Failed to load page', 'error');
  }
}

// Link Interceptor
document.addEventListener('click', e => {
  const link = e.target.closest('[data-link]');
  if (link) {
    e.preventDefault();
    const href = link.getAttribute('href');
    history.pushState(null, '', href);
    navigate(href);
  }
});

// Back/Forward support
window.addEventListener('popstate', () => navigate(location.pathname + location.search));

// Initial Load
navigate(location.pathname + location.search);
