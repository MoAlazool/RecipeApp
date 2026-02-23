(function () {
  const root = document.documentElement;
  root.classList.add('js-ready');

  const scenes = Array.from(document.querySelectorAll('[data-scene]'));
  const navLinks = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
  const progressBar = document.getElementById('scroll-progress-bar');
  const sceneDockLabel = document.getElementById('scene-dock-label');
  const parallaxNodes = Array.from(document.querySelectorAll('[data-depth]'));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!scenes.length) return;

  const setActiveNav = (id) => {
    navLinks.forEach((link) => {
      const target = link.getAttribute('href')?.slice(1);
      link.classList.toggle('is-active', target === id);
    });
  };

  const getSceneLabel = (scene) => {
    const number = scene.querySelector('.scene-number')?.textContent?.trim() || '';
    const title = scene.querySelector('h2')?.textContent?.trim() || scene.id;
    return number ? `${number} • ${title}` : title;
  };

  const setCurrentScene = (scene) => {
    scenes.forEach((item) => item.classList.toggle('is-current', item === scene));
    setActiveNav(scene.id);
    if (sceneDockLabel) {
      sceneDockLabel.textContent = getSceneLabel(scene);
    }
  };

  setCurrentScene(scenes[0]);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    },
    {
      threshold: [0.02, 0.1, 0.2, 0.45],
      rootMargin: '-4% 0px -10% 0px',
    }
  );

  scenes.forEach((scene) => observer.observe(scene));

  const getCurrentScene = () => {
    const targetY = window.innerHeight * 0.36;
    let bestScene = scenes[0];
    let bestDistance = Number.POSITIVE_INFINITY;

    scenes.forEach((scene) => {
      const rect = scene.getBoundingClientRect();
      const focusPoint = rect.top + Math.min(rect.height * 0.4, 260);
      const distance = Math.abs(focusPoint - targetY);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestScene = scene;
      }
    });

    return bestScene;
  };

  const updateProgress = () => {
    if (!progressBar) return;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = maxScroll > 0 ? Math.min(window.scrollY / maxScroll, 1) : 0;
    progressBar.style.transform = `scaleX(${ratio})`;
  };

  const updateParallax = () => {
    if (reduceMotion || !parallaxNodes.length) return;

    const viewportCenter = window.innerHeight / 2;
    parallaxNodes.forEach((node) => {
      const scene = node.closest('[data-scene]') || node;
      const rect = scene.getBoundingClientRect();
      const sceneCenter = rect.top + rect.height / 2;
      const depth = Number.parseFloat(node.getAttribute('data-depth') || '0');
      const offset = (sceneCenter - viewportCenter) * depth;
      node.style.setProperty('--parallax', `${offset.toFixed(2)}px`);
    });
  };

  let framePending = false;
  const onScrollFrame = () => {
    framePending = false;
    updateProgress();
    setCurrentScene(getCurrentScene());
    updateParallax();
  };

  const requestFrame = () => {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(onScrollFrame);
  };

  onScrollFrame();
  window.addEventListener('scroll', requestFrame, { passive: true });
  window.addEventListener('resize', requestFrame);

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const root = document.documentElement;
    const currentTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    const effectiveTheme = currentTheme || (prefersDark ? 'dark' : 'light');
    root.setAttribute('data-theme', effectiveTheme);

    themeToggle.addEventListener('click', () => {
      const newTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });
  }
})();
