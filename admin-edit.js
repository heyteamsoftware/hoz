/**
 * Admin Edit Module
 * Enables inline editing of content when logged in as admin
 */

class AdminEditor {
  constructor() {
    this.isAdmin = false;
    this.content = {};
    this.init();
  }

  async init() {
    // Check if user is logged in
    await this.checkSession();

    if (this.isAdmin) {
      // Load content
      await this.loadContent();
      // Setup editing UI
      this.setupEditingUI();
      // Show admin toolbar
      this.showAdminToolbar();
    }
  }

  async checkSession() {
    try {
      const response = await fetch('/api/me');
      if (response.ok) {
        const data = await response.json();
        this.isAdmin = data.isAdmin;
      }
    } catch (e) {
      console.error('Session check failed:', e);
    }
  }

  async loadContent() {
    try {
      const response = await fetch('/api/content');
      this.content = await response.json();
    } catch (e) {
      console.error('Failed to load content:', e);
    }
  }

  setupEditingUI() {
    // Find all elements with data-editable attribute
    document.querySelectorAll('[data-editable]').forEach(el => {
      // Add hover effect
      el.style.position = 'relative';

      el.addEventListener('mouseenter', () => {
        this.addEditIcon(el);
      });

      el.addEventListener('mouseleave', (e) => {
        if (!e.target.classList.contains('edit-icon')) {
          this.removeEditIcon(el);
        }
      });

      // Click to edit
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-icon') ||
            e.target.closest('.edit-icon')) {
          e.stopPropagation();
          this.openEditor(el);
        }
      });
    });
  }

  addEditIcon(el) {
    if (el.querySelector('.edit-icon')) return;

    const icon = document.createElement('button');
    icon.className = 'edit-icon';
    icon.innerHTML = '✏️';
    icon.title = 'Editar contenido';
    icon.type = 'button';

    // Position absolute in the corner
    icon.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: var(--clay);
      color: white;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    `;

    el.appendChild(icon);
  }

  removeEditIcon(el) {
    const icon = el.querySelector('.edit-icon');
    if (icon) icon.remove();
  }

  openEditor(el) {
    // Remove the hover icon before reading content so its text isn't captured
    this.removeEditIcon(el);

    const key = el.getAttribute('data-editable');
    const field = el.getAttribute('data-field');
    const isRich = el.getAttribute('data-type') === 'html';
    const currentValue = isRich ? el.innerHTML.trim() : el.textContent.trim();

    const modal = document.createElement('div');
    modal.className = 'edit-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      padding: 32px;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
      max-width: 600px;
      width: 90%;
    `;

    let input;
    if (isRich) {
      input = document.createElement('textarea');
      input.value = el.innerHTML;
      input.rows = 8;
    } else {
      input = document.createElement('textarea');
      input.value = currentValue;
      input.rows = 4;
    }

    input.style.cssText = `
      width: 100%;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 6px;
      font-family: inherit;
      font-size: 14px;
      resize: vertical;
    `;

    const buttons = document.createElement('div');
    buttons.style.cssText = `
      margin-top: 24px;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    `;

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Guardar';
    saveBtn.style.cssText = `
      padding: 10px 24px;
      background: var(--clay);
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.style.cssText = `
      padding: 10px 24px;
      background: var(--line);
      color: var(--ink);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
    `;

    // Handle save
    saveBtn.addEventListener('click', async () => {
      const newValue = input.value;

      try {
        const response = await fetch('/api/content/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, field, value: newValue })
        });

        if (response.ok) {
          if (isRich) {
            el.innerHTML = newValue;
          } else {
            el.textContent = newValue;
          }
          modal.remove();
        } else if (response.status === 401) {
          modal.remove();
          alert('Sesión expirada. Inicia sesión de nuevo.');
          document.getElementById('login-modal').style.display = 'flex';
        } else {
          const err = await response.json().catch(() => ({}));
          alert('Error al guardar: ' + (err.error || response.status));
        }
      } catch (e) {
        console.error('Save failed:', e);
        alert('Error de red al guardar. Verifica que el servidor esté en marcha.');
      }
    });

    cancelBtn.addEventListener('click', () => modal.remove());

    buttons.appendChild(saveBtn);
    buttons.appendChild(cancelBtn);

    content.appendChild(document.createElement('h3')).textContent = 'Editar contenido';
    content.appendChild(input);
    content.appendChild(buttons);

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    // Focus input
    input.focus();
  }

  showAdminToolbar() {
    // Find or create admin toolbar
    let toolbar = document.getElementById('admin-toolbar');

    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = 'admin-toolbar';
      toolbar.style.cssText = `
        position: fixed;
        top: 72px;
        right: 0;
        padding: 16px 24px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        z-index: 99;
        border-radius: 0;
        font-size: 13px;
      `;
      document.body.appendChild(toolbar);
    }

    const logoutBtn = document.createElement('button');
    logoutBtn.textContent = '🚪 Cerrar sesión';
    logoutBtn.style.cssText = `
      padding: 8px 16px;
      background: transparent;
      color: white;
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    `;

    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      location.reload();
    });

    toolbar.innerHTML = '✏️ <strong>Modo edición activo</strong>&nbsp;&nbsp;';
    toolbar.appendChild(logoutBtn);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new AdminEditor());
} else {
  new AdminEditor();
}
