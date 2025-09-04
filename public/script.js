// Smooth scroll
document.addEventListener("click", (e) => {
  const trigger = e.target.closest('[data-scroll-to], nav a[href^="#"]')
  if (!trigger) return
  const target = trigger.getAttribute("data-scroll-to") || trigger.getAttribute("href")
  if (!target || !target.startsWith("#")) return
  e.preventDefault()
  const el = document.querySelector(target)
  el?.scrollIntoView({ behavior: "smooth", block: "start" })
})

// Theme
;(function theme() {
  const html = document.documentElement
  const desktopToggle = document.getElementById("theme-toggle")
  const mobileToggle = document.getElementById("theme-toggle-mobile")
  const extraToggles = document.querySelectorAll("[data-theme-toggle]")
  const saved = localStorage.getItem("theme")
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches

  function setPressed(theme) {
    const pressed = theme === "dark" ? "true" : "false"
    desktopToggle?.setAttribute("aria-pressed", pressed)
    mobileToggle?.setAttribute("aria-pressed", pressed)
    extraToggles.forEach((btn) => btn.setAttribute("aria-pressed", pressed))
  }

  function apply(theme) {
    html.setAttribute("data-theme", theme)
    setPressed(theme)
  }

  apply(saved || (prefersDark ? "dark" : "light"))

  function toggle() {
    const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark"
    apply(next)
    localStorage.setItem("theme", next)
  }

  desktopToggle?.addEventListener("click", toggle)
  mobileToggle?.addEventListener("click", toggle)
  extraToggles.forEach((btn) => btn.addEventListener("click", toggle))
})()
;(function mobileNav() {
  const openBtn = document.querySelector(".nav-toggle")
  const closeBtn = document.querySelector(".close-menu")
  const scrim = document.querySelector(".scrim")
  const mobileMenu = document.getElementById("mobileMenu")
  let lastActiveEl = null

  function firstFocusable(container) {
    return container?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  }

  function setOpen(open) {
    document.body.classList.toggle("nav-open", open)
    document.body.style.overflow = open ? "hidden" : ""
    openBtn?.setAttribute("aria-expanded", String(open))
    openBtn?.setAttribute("aria-label", open ? "Close menu" : "Open menu")
    mobileMenu?.setAttribute("aria-hidden", String(!open))

    if (open) {
      lastActiveEl = document.activeElement
      const f = firstFocusable(mobileMenu)
      f?.focus()
    } else {
      lastActiveEl && lastActiveEl instanceof HTMLElement && lastActiveEl.focus()
    }
  }

  openBtn?.addEventListener("click", () => {
    const isOpen = document.body.classList.contains("nav-open")
    setOpen(!isOpen)
  })

  closeBtn?.addEventListener("click", () => setOpen(false))
  scrim?.addEventListener("click", () => setOpen(false))

  mobileMenu?.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false)
  })

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("nav-open")) setOpen(false)
  })

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 768) setOpen(false)
  })
})()

// Footer year
document.getElementById("year").textContent = new Date().getFullYear()

// Toast utility (single source)
const toast = document.getElementById("toast")
function showToast(message, ms = 2000) {
  if (!toast) return
  toast.textContent = message
  toast.setAttribute("aria-hidden", "false")
  toast.classList.add("show")
  setTimeout(() => {
    toast.classList.remove("show")
    toast.setAttribute("aria-hidden", "true")
  }, ms)
}
// Contact form (client-side validation only)
;(function contactForm() {
  const form = document.getElementById("contactForm")
  function setHint(id, text) {
    const hint = form?.querySelector(`.field-hint[data-for="${id}"]`)
    if (hint) hint.textContent = text || ""
  }
  form?.addEventListener("submit", (e) => {
    e.preventDefault()
    const name = form.name.value.trim()
    const email = form.email.value.trim()
    const message = form.message.value.trim()
    let valid = true
    setHint("name", "")
    setHint("email", "")
    setHint("message", "")
    if (!name) {
      setHint("name", "Please enter your name.")
      valid = false
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setHint("email", "Enter a valid email.")
      valid = false
    }
    if (!message || message.length < 10) {
      setHint("message", "Please provide more details (min 10 chars).")
      valid = false
    }
    if (!valid) return
    showToast("Message sent! We’ll be in touch soon.", 2400)
    form.reset()
  })
})()

// Auth modal (mock)
;(function enhanceAuthOpeners() {
  const modal = document.getElementById("authModal")
  const openBtn = document.getElementById("loginBtn")
  const openBtnMobile = document.getElementById("loginBtnMobile")
  const authTitle = document.getElementById("authTitle")
  const loginTabBtn = document.getElementById("loginTabBtn")
  const signupTabBtn = document.getElementById("signupTabBtn")
  const loginPanel = document.getElementById("loginTab")
  const signupPanel = document.getElementById("signupTab")

  function openModal() {
    modal.setAttribute("aria-hidden", "false")
    document.body.style.overflow = "hidden"
  }
  function activate(which) {
    const loginActive = which === "login"
    loginTabBtn.classList.toggle("active", loginActive)
    signupTabBtn.classList.toggle("active", !loginActive)
    loginTabBtn.setAttribute("aria-selected", String(loginActive))
    signupTabBtn.setAttribute("aria-selected", String(!loginActive))
    loginPanel.classList.toggle("active", loginActive)
    signupPanel.classList.toggle("active", !loginActive)
    authTitle.textContent = loginActive ? "Welcome back" : "Create your account"
  }

  // New: bind all triggers with data-open-auth
  document.querySelectorAll("[data-open-auth]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-open-auth") === "signup" ? "signup" : "login"
      activate(mode)
      openModal()
    })
  })

  // Keep existing openers working
  openBtn?.addEventListener("click", () => {
    activate("login")
    openModal()
  })
  openBtnMobile?.addEventListener("click", () => {
    activate("login")
    openModal()
  })
})()

// Auth modal controls: add close handlers, tab switching, and focus restore
;(function authModalControls() {
  const modal = document.getElementById("authModal")
  if (!modal) return

  const authTitle = document.getElementById("authTitle")
  const loginTabBtn = document.getElementById("loginTabBtn")
  const signupTabBtn = document.getElementById("signupTabBtn")
  const loginPanel = document.getElementById("loginTab")
  const signupPanel = document.getElementById("signupTab")
  const closers = modal.querySelectorAll("[data-close-modal]")
  let lastTrigger = null

  // Remember opener to restore focus after close
  document.addEventListener(
    "click",
    (e) => {
      const opener = e.target.closest("[data-open-auth], #loginBtn, #loginBtnMobile")
      if (opener) lastTrigger = opener
    },
    true,
  )

  function activate(which) {
    const loginActive = which === "login"
    loginTabBtn?.classList.toggle("active", loginActive)
    signupTabBtn?.classList.toggle("active", !loginActive)
    loginTabBtn?.setAttribute("aria-selected", String(loginActive))
    signupTabBtn?.setAttribute("aria-selected", String(!loginActive))
    loginPanel?.classList.toggle("active", loginActive)
    signupPanel?.classList.toggle("active", !loginActive)
    if (authTitle) authTitle.textContent = loginActive ? "Welcome back" : "Create your account"
  }

  function closeModal() {
    modal.setAttribute("aria-hidden", "true")
    document.body.style.overflow = ""
    // restore focus to the opener if possible
    if (lastTrigger && typeof lastTrigger.focus === "function") {
      setTimeout(() => lastTrigger.focus(), 0)
    }
  }

  // Wire the tab buttons to switch panels (“slide” is handled by CSS transition)
  loginTabBtn?.addEventListener("click", () => activate("login"))
  signupTabBtn?.addEventListener("click", () => activate("signup"))

  // Close via X button(s) and backdrop
  closers.forEach((btn) => btn.addEventListener("click", closeModal))

  // Close on ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") {
      closeModal()
    }
  })
})()

// Lazy preloader: hide on window load, with safety timeout
;(function preloader() {
  const el = document.getElementById("preloader")
  function hide() {
    el?.classList.add("hidden")
  }
  window.addEventListener("load", hide)
  setTimeout(hide, 2000) // safety in case 'load' is delayed
})()


// === Signup handling with SweetAlert2 ===
// Helper: force login tab active
function setAuthTab(tab) {
  const loginBtn = document.getElementById('loginTabBtn');
  const signupBtn = document.getElementById('signupTabBtn');
  const loginPanel = document.getElementById('loginTab');
  const signupPanel = document.getElementById('signupTab');
  const authTitle = document.getElementById('authTitle');

  if (tab === 'login') {
    loginBtn?.classList.add('active'); loginBtn?.setAttribute('aria-selected','true');
    signupBtn?.classList.remove('active'); signupBtn?.setAttribute('aria-selected','false');
    loginPanel?.classList.add('active'); loginPanel?.setAttribute('aria-hidden','false');
    signupPanel?.classList.remove('active'); signupPanel?.setAttribute('aria-hidden','true');
    if (authTitle) authTitle.textContent = "Welcome back";
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const signupForm = document.getElementById('signupTab');
  const loginForm = document.getElementById('loginTab');

  // -------- Signup Form --------
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(signupForm);
      const data = Object.fromEntries(formData.entries());

      if (!data.fullName || !data.email || !data.password || !data.college) {
        Swal.fire({
          icon: 'warning',
          title: 'Missing fields',
          text: 'Please fill all the fields before submitting'
        });
        return;
      }

      try {
        const res = await fetch(signupForm.action || '/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          credentials: 'same-origin'
        });

        const result = await res.json();

        if (result.success) {
          Swal.fire({
            icon: 'success',
            title: 'Registration successful',
            text: result.message || 'You can now log in.',
            showConfirmButton: false,
            timer: 1800,
            timerProgressBar: true
          });

          // Autofill login email
          const loginEmail = document.getElementById('loginEmail');
          if (loginEmail) loginEmail.value = result.email || data.email;

          setTimeout(() => {
            setAuthTab('login');
            document.getElementById('loginPassword')?.focus();
          }, 1400);

        } else {
          Swal.fire({
            icon: 'error',
            title: 'Registration failed',
            text: result.message || 'Please try again'
          });
        }
      } catch (err) {
        console.error(err);
        Swal.fire({
          icon: 'error',
          title: 'Network error',
          text: 'Could not reach server. Try again.'
        });
      }
    });
  }

  // -------- Login Form --------
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(loginForm);
      const data = Object.fromEntries(formData.entries());

      if (!data.email || !data.password) {
        Swal.fire({
          icon: 'warning',
          title: 'Missing fields',
          text: 'Please enter both email and password'
        });
        return;
      }

      try {
        const res = await fetch(loginForm.action || '/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          credentials: 'same-origin'
        });

        // Server redirect ko handle karna
        if (res.redirected) {
          Swal.fire({
            icon: 'success',
            title: 'Login successful',
            showConfirmButton: false,
            timer: 1500,
            timerProgressBar: true
          });
          setTimeout(() => {
            window.location.href = res.url; // /dashboard redirect
          }, 1400);
          return;
        }

        const result = await res.json();

        if (result.success) {
          Swal.fire({
            icon: 'success',
            title: 'Login successful',
            showConfirmButton: false,
            timer: 1500,
            timerProgressBar: true
          });
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 1400);
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Login failed',
            text: result.message || 'Invalid credentials'
          });
        }

      } catch (err) {
        console.error(err);
        Swal.fire({
          icon: 'error',
          title: 'Network error',
          text: 'Could not reach server. Try again.'
        });
      }
    });
  }
});
