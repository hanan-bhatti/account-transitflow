// File: managers/ModalManager.js
class ModalManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }

    initModals() {
        document.getElementById('modalClose')?.addEventListener('click', () => {
            this.hideModal();
        });

        document.getElementById('modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                this.hideModal();
            }
        });
    }

    showModal(title, content = '') {
        document.getElementById('modalTitle').textContent = title;
        if (content) {
            document.getElementById('modalBody').innerHTML = content;
        }
        document.getElementById('modal').classList.add('show');
    }

    hideModal() {
        document.getElementById('modal').classList.remove('show');
    }

    showModaldeletion(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.classList.add('modal-open');
        }
    }

    hideModaldeletion(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');

            // Reset form if it's the deletion modal
            if (modalId === 'accountDeletionModal') {
                const form = document.getElementById('accountDeletionForm');
                if (form) {
                    form.reset();
                    document.getElementById('confirmDeletionBtn').disabled = true;
                }
            }
        }
    }

    /**
     * Enhanced confirm dialog with support for various options
     * @param {Object} options - Configuration options
     * @param {string} options.title - Dialog title
     * @param {string} options.message - Dialog message
     * @param {string} [options.confirmText='Confirm'] - Confirm button text
     * @param {string} [options.cancelText='Cancel'] - Cancel button text
     * @param {boolean} [options.dangerMode=false] - Use danger styling for confirm button
     * @param {string} [options.inputPlaceholder] - Show input field with placeholder
     * @param {string} [options.checkboxLabel] - Show checkbox with label
     * @param {string} [options.requireExactMatch] - Require exact text match to enable confirm
     * @returns {Promise<{confirmed: boolean, inputValue?: string, checkboxValue?: boolean}>}
     */
    async showConfirmDialog(options = {}) {
        const {
            title = 'Confirm Action',
            message = 'Are you sure?',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            dangerMode = false,
            inputPlaceholder = '',
            checkboxLabel = '',
            requireExactMatch = ''
        } = options;

        return new Promise((resolve) => {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';
            Object.assign(overlay.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                background: 'var(--bg-overlay)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: '10000',
                opacity: '0',
                transition: 'opacity 0.2s ease'
            });

            // Create modal
            const modal = document.createElement('div');
            modal.className = 'confirm-modal';
            Object.assign(modal.style, {
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                padding: '24px',
                borderRadius: '12px',
                maxWidth: '420px',
                width: '100%',
                margin: '20px',
                boxShadow: '0 20px 60px var(--shadow-lg)',
                transform: 'scale(0.9) translateY(-20px)',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit'
            });

            // Title
            const titleEl = document.createElement('h3');
            titleEl.textContent = title;
            Object.assign(titleEl.style, {
                margin: '0 0 12px 0',
                color: 'var(--text-primary)',
                fontSize: '18px',
                fontWeight: '600',
                lineHeight: '1.4'
            });

            // Message
            const messageEl = document.createElement('p');
            messageEl.textContent = message;
            Object.assign(messageEl.style, {
                margin: '0 0 20px 0',
                color: 'var(--text-secondary)',
                fontSize: '14px',
                lineHeight: '1.5'
            });

            // Input field (optional)
            let inputEl = null;
            if (inputPlaceholder) {
                inputEl = document.createElement('input');
                inputEl.type = 'text';
                inputEl.placeholder = inputPlaceholder;
                inputEl.className = 'confirm-input';
                Object.assign(inputEl.style, {
                    width: '100%',
                    padding: '8px 12px',
                    margin: '0 0 16px 0',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                });

                inputEl.addEventListener('focus', () => {
                    inputEl.style.borderColor = 'var(--accent-primary)';
                });

                inputEl.addEventListener('blur', () => {
                    inputEl.style.borderColor = 'var(--border-color)';
                });
            }

            // Exact match validation
            let confirmBtn;
            if (requireExactMatch && inputEl) {
                inputEl.addEventListener('input', () => {
                    const matches = inputEl.value === requireExactMatch;
                    confirmBtn.disabled = !matches;
                    confirmBtn.style.opacity = matches ? '1' : '0.5';
                });
            }

            // Checkbox (optional)
            let checkboxEl = null;
            const checkboxContainer = document.createElement('label');

            if (checkboxLabel) {
                checkboxContainer.className = 'confirm-checkbox-container';
                Object.assign(checkboxContainer.style, {
                    display: 'flex',
                    alignItems: 'center',
                    margin: '0 0 16px 0',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    fontSize: '14px'
                });

                checkboxEl = document.createElement('input');
                checkboxEl.type = 'checkbox';
                checkboxEl.className = 'confirm-checkbox';
                Object.assign(checkboxEl.style, {
                    marginRight: '8px',
                    accentColor: 'var(--accent-primary)'
                });

                const checkboxLabelEl = document.createElement('span');
                checkboxLabelEl.textContent = checkboxLabel;

                checkboxContainer.appendChild(checkboxEl);
                checkboxContainer.appendChild(checkboxLabelEl);
                modal.appendChild(checkboxContainer);
            }

            // Buttons container
            const btnContainer = document.createElement('div');
            btnContainer.className = 'confirm-buttons';
            Object.assign(btnContainer.style, {
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                marginTop: '20px'
            });

            // Cancel button
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = cancelText;
            cancelBtn.className = 'confirm-cancel-btn';
            Object.assign(cancelBtn.style, {
                padding: '8px 16px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                minWidth: '80px'
            });

            // Confirm button
            confirmBtn = document.createElement('button');
            confirmBtn.textContent = confirmText;
            confirmBtn.className = 'confirm-confirm-btn';
            const confirmBg = dangerMode ? 'var(--danger)' : 'var(--accent-primary)';
            Object.assign(confirmBtn.style, {
                padding: '8px 16px',
                background: confirmBg,
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                minWidth: '80px'
            });

            // Initially disable confirm button if exact match required
            if (requireExactMatch) {
                confirmBtn.disabled = true;
                confirmBtn.style.opacity = '0.5';
            }

            // Button hover effects
            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = 'var(--bg-secondary)';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = 'var(--bg-tertiary)';
            });

            confirmBtn.addEventListener('mouseenter', () => {
                if (!confirmBtn.disabled) {
                    confirmBtn.style.transform = 'translateY(-1px)';
                    confirmBtn.style.boxShadow = `0 4px 12px ${dangerMode ? 'rgba(220, 53, 69, 0.3)' : 'rgba(0, 123, 255, 0.3)'}`;
                }
            });
            confirmBtn.addEventListener('mouseleave', () => {
                confirmBtn.style.transform = 'translateY(0)';
                confirmBtn.style.boxShadow = 'none';
            });

            // Close helper
            const close = (confirmed) => {
                // Cleanup
                document.removeEventListener('keydown', keyHandler);
                overlay.removeEventListener('click', overlayClick);

                // Animate out
                overlay.style.opacity = '0';
                modal.style.transform = 'scale(0.9) translateY(-20px)';

                setTimeout(() => {
                    overlay.remove();
                    resolve({
                        confirmed,
                        inputValue: inputEl ? inputEl.value : undefined,
                        checkboxValue: checkboxEl ? checkboxEl.checked : undefined
                    });
                }, 200);
            };

            // Event handlers
            const overlayClick = (e) => {
                if (e.target === overlay) close(false);
            };

            const keyHandler = (e) => {
                if (e.key === 'Escape') {
                    close(false);
                } else if (e.key === 'Enter' && !confirmBtn.disabled) {
                    close(true);
                }
            };

            // Button actions
            cancelBtn.onclick = () => close(false);
            confirmBtn.onclick = () => {
                if (!confirmBtn.disabled) close(true);
            };

            // Attach listeners
            overlay.addEventListener('click', overlayClick);
            document.addEventListener('keydown', keyHandler);

            // Build modal
            modal.appendChild(titleEl);
            modal.appendChild(messageEl);
            if (inputEl) modal.appendChild(inputEl);
            if (checkboxEl) modal.appendChild(checkboxContainer);
            btnContainer.appendChild(cancelBtn);
            btnContainer.appendChild(confirmBtn);
            modal.appendChild(btnContainer);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Animate in
            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                modal.style.transform = 'scale(1) translateY(0)';
            });

            // Auto-focus input or first button
            setTimeout(() => {
                if (inputEl) {
                    inputEl.focus();
                } else {
                    confirmBtn.focus();
                }
            }, 300);
        });
    }

    /**
     * Select dialog with dropdown options
     * @param {Object} options - Configuration options
     * @param {string} options.title - Dialog title
     * @param {string} options.message - Dialog message
     * @param {Array<{value: string, label: string}>} options.options - Select options
     * @param {string} [options.confirmText='Select'] - Confirm button text
     * @param {string} [options.cancelText='Cancel'] - Cancel button text
     * @param {string} [options.inputPlaceholder] - Show additional input field
     * @param {string} [options.defaultValue] - Default selected value
     * @returns {Promise<{confirmed: boolean, selectedValue?: string, inputValue?: string}>}
     */
    async showSelectDialog(options = {}) {
        const {
            title = 'Select Option',
            message = 'Please select an option:',
            options: selectOptions = [],
            confirmText = 'Select',
            cancelText = 'Cancel',
            inputPlaceholder = '',
            defaultValue = ''
        } = options;

        return new Promise((resolve) => {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'select-overlay';
            Object.assign(overlay.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                background: 'var(--bg-overlay)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: '10000',
                opacity: '0',
                transition: 'opacity 0.2s ease'
            });

            // Create modal
            const modal = document.createElement('div');
            modal.className = 'select-modal';
            Object.assign(modal.style, {
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                padding: '24px',
                borderRadius: '12px',
                maxWidth: '420px',
                width: '100%',
                margin: '20px',
                boxShadow: '0 20px 60px var(--shadow-lg)',
                transform: 'scale(0.9) translateY(-20px)',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit'
            });

            // Title
            const titleEl = document.createElement('h3');
            titleEl.textContent = title;
            Object.assign(titleEl.style, {
                margin: '0 0 12px 0',
                color: 'var(--text-primary)',
                fontSize: '18px',
                fontWeight: '600',
                lineHeight: '1.4'
            });

            // Message
            const messageEl = document.createElement('p');
            messageEl.textContent = message;
            Object.assign(messageEl.style, {
                margin: '0 0 20px 0',
                color: 'var(--text-secondary)',
                fontSize: '14px',
                lineHeight: '1.5'
            });

            // Select dropdown
            const selectEl = document.createElement('select');
            selectEl.className = 'select-dropdown';
            Object.assign(selectEl.style, {
                width: '100%',
                padding: '10px 12px',
                margin: '0 0 16px 0',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontFamily: 'inherit',
                outline: 'none',
                cursor: 'pointer',
                transition: 'border-color 0.2s ease'
            });

            // Add default empty option
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = 'Select an option...';
            emptyOption.disabled = true;
            emptyOption.selected = !defaultValue;
            selectEl.appendChild(emptyOption);

            // Add select options
            selectOptions.forEach(opt => {
                const optionEl = document.createElement('option');
                optionEl.value = opt.value;
                optionEl.textContent = opt.label;
                optionEl.selected = opt.value === defaultValue;
                selectEl.appendChild(optionEl);
            });

            selectEl.addEventListener('focus', () => {
                selectEl.style.borderColor = 'var(--accent-primary)';
            });

            selectEl.addEventListener('blur', () => {
                selectEl.style.borderColor = 'var(--border-color)';
            });

            // Input field (optional)
            let inputEl = null;
            if (inputPlaceholder) {
                inputEl = document.createElement('input');
                inputEl.type = 'text';
                inputEl.placeholder = inputPlaceholder;
                inputEl.className = 'select-input';
                Object.assign(inputEl.style, {
                    width: '100%',
                    padding: '8px 12px',
                    margin: '0 0 16px 0',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                });

                inputEl.addEventListener('focus', () => {
                    inputEl.style.borderColor = 'var(--accent-primary)';
                });

                inputEl.addEventListener('blur', () => {
                    inputEl.style.borderColor = 'var(--border-color)';
                });
            }

            // Buttons container
            const btnContainer = document.createElement('div');
            btnContainer.className = 'select-buttons';
            Object.assign(btnContainer.style, {
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                marginTop: '20px'
            });

            // Cancel button
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = cancelText;
            cancelBtn.className = 'select-cancel-btn';
            Object.assign(cancelBtn.style, {
                padding: '8px 16px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                minWidth: '80px'
            });

            // Confirm button
            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = confirmText;
            confirmBtn.className = 'select-confirm-btn';
            Object.assign(confirmBtn.style, {
                padding: '8px 16px',
                background: 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                minWidth: '80px',
                opacity: selectEl.value ? '1' : '0.5'
            });

            confirmBtn.disabled = !selectEl.value;

            // Update confirm button state when selection changes
            selectEl.addEventListener('change', () => {
                confirmBtn.disabled = !selectEl.value;
                confirmBtn.style.opacity = selectEl.value ? '1' : '0.5';
            });

            // Button hover effects
            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = 'var(--bg-secondary)';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = 'var(--bg-tertiary)';
            });

            confirmBtn.addEventListener('mouseenter', () => {
                if (!confirmBtn.disabled) {
                    confirmBtn.style.transform = 'translateY(-1px)';
                    confirmBtn.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.3)';
                }
            });
            confirmBtn.addEventListener('mouseleave', () => {
                confirmBtn.style.transform = 'translateY(0)';
                confirmBtn.style.boxShadow = 'none';
            });

            // Close helper
            const close = (confirmed) => {
                // Cleanup
                document.removeEventListener('keydown', keyHandler);
                overlay.removeEventListener('click', overlayClick);

                // Animate out
                overlay.style.opacity = '0';
                modal.style.transform = 'scale(0.9) translateY(-20px)';

                setTimeout(() => {
                    overlay.remove();
                    resolve({
                        confirmed,
                        selectedValue: confirmed ? selectEl.value : undefined,
                        inputValue: inputEl ? inputEl.value : undefined
                    });
                }, 200);
            };

            // Event handlers
            const overlayClick = (e) => {
                if (e.target === overlay) close(false);
            };

            const keyHandler = (e) => {
                if (e.key === 'Escape') {
                    close(false);
                } else if (e.key === 'Enter' && !confirmBtn.disabled) {
                    close(true);
                }
            };

            // Button actions
            cancelBtn.onclick = () => close(false);
            confirmBtn.onclick = () => {
                if (!confirmBtn.disabled) close(true);
            };

            // Attach listeners
            overlay.addEventListener('click', overlayClick);
            document.addEventListener('keydown', keyHandler);

            // Build modal
            modal.appendChild(titleEl);
            modal.appendChild(messageEl);
            modal.appendChild(selectEl);
            if (inputEl) modal.appendChild(inputEl);
            btnContainer.appendChild(cancelBtn);
            btnContainer.appendChild(confirmBtn);
            modal.appendChild(btnContainer);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Animate in
            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                modal.style.transform = 'scale(1) translateY(0)';
            });

            // Auto-focus select
            setTimeout(() => {
                selectEl.focus();
            }, 300);
        });
    }

    async showConfirm(message) {
        return new Promise((resolve) => {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.background = 'var(--bg-overlay)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.zIndex = '9999';

            // Create modal
            const modal = document.createElement('div');
            modal.style.background = 'var(--bg-secondary)';
            modal.style.padding = '20px';
            modal.style.borderRadius = '8px';
            modal.style.maxWidth = '320px';
            modal.style.width = '100%';
            modal.style.textAlign = 'center';
            modal.style.boxShadow = '0 4px 12px var(--shadow)';
            modal.style.fontFamily = 'sans-serif';

            // Message
            const msg = document.createElement('p');
            msg.textContent = message;
            msg.style.marginBottom = '15px';
            msg.style.color = 'var(--text-primary)'
            msg.style.fontSize = '14px';
            msg.style.lineHeight = '1.4';

            // Buttons container
            const btnContainer = document.createElement('div');
            btnContainer.style.display = 'flex';
            btnContainer.style.justifyContent = 'center';
            btnContainer.style.gap = '10px';

            const yesBtn = document.createElement('button');
            yesBtn.textContent = 'Yes';
            yesBtn.style.padding = '6px 14px';
            yesBtn.style.background = 'var(--success)';
            yesBtn.style.color = '#fff';
            yesBtn.style.border = 'none';
            yesBtn.style.borderRadius = '4px';
            yesBtn.style.cursor = 'pointer';

            const noBtn = document.createElement('button');
            noBtn.textContent = 'No';
            noBtn.style.padding = '6px 14px';
            noBtn.style.background = 'var(--danger)';
            noBtn.style.color = '#fff';
            noBtn.style.border = 'none';
            noBtn.style.borderRadius = '4px';
            noBtn.style.cursor = 'pointer';

            // Close helper
            const close = (value) => {
                document.removeEventListener('keydown', keyHandler);
                overlay.removeEventListener('click', overlayClick);
                overlay.remove();
                resolve(value);
            };

            // Event: Click outside
            const overlayClick = (e) => {
                if (e.target === overlay) close(false);
            };

            // Event: Escape key
            const keyHandler = (e) => {
                if (e.key === 'Escape') close(false);
            };

            // Button actions
            yesBtn.onclick = () => close(true);
            noBtn.onclick = () => close(false);

            // Attach listeners
            overlay.addEventListener('click', overlayClick);
            document.addEventListener('keydown', keyHandler);

            // Build modal
            btnContainer.appendChild(yesBtn);
            btnContainer.appendChild(noBtn);
            modal.appendChild(msg);
            modal.appendChild(btnContainer);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
        });
    }
}