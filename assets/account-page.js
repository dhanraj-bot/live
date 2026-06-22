document.addEventListener('DOMContentLoaded', function() {
    // Store original body styles to restore later
    let originalBodyStyle = {};
    
    // Function to prevent body scroll without layout shift
    function preventBodyScroll() {
        // Store original styles
        originalBodyStyle = {
            overflow: document.body.style.overflow,
            position: document.body.style.position,
            top: document.body.style.top,
            width: document.body.style.width
        };
        
        // Get current scroll position
        const scrollY = window.scrollY;
        
        // Apply styles to prevent scroll without layout shift
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';
    }
    
    // Function to restore body scroll
    function restoreBodyScroll() {
        // Get the scroll position from the top style
        const scrollY = parseInt(document.body.style.top || '0') * -1;
        
        // Restore original styles
        document.body.style.overflow = originalBodyStyle.overflow || '';
        document.body.style.position = originalBodyStyle.position || '';
        document.body.style.top = originalBodyStyle.top || '';
        document.body.style.width = originalBodyStyle.width || '';
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
    }

    // Load updated profile data from localStorage if available
    const updatedProfileData = localStorage.getItem('updatedProfileData');
    if (updatedProfileData) {
        try {
            const profileData = JSON.parse(updatedProfileData);
            const profileInfo = document.querySelector('.profile-info');
            if (profileInfo) {
                // Update name
                const nameField = profileInfo.querySelector('.profile-row:first-child .profile-field:first-child .field-value');
                if (nameField) {
                    nameField.textContent = `${profileData.firstName} ${profileData.lastName}`.trim();
                }
                // Update email
                const emailField = profileInfo.querySelector('.profile-row:first-child .profile-field:last-child .field-value');
                if (emailField) {
                    emailField.textContent = profileData.email;
                }
                // Update phone - it's in the second profile-row
                const phoneField = profileInfo.querySelector('.profile-row:nth-child(2) .profile-field .field-value');
                if (phoneField) {
                    phoneField.textContent = profileData.phone;
                }
            }
        } catch (error) {
            localStorage.removeItem('updatedProfileData');
        }
    }

    // Tab switching functionality
    const navLinks = document.querySelectorAll('.nav-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const mobileDrawer = document.getElementById('mobile-drawer');
    const drawerOverlay = document.getElementById('drawer-overlay');
    const drawerClose = document.getElementById('drawer-close');
    const drawerTitle = document.getElementById('drawer-title');
    const drawerBody = document.getElementById('drawer-body');

    // Function to switch tabs (desktop)
    function switchTab(tabId) {
        // Remove active class from all nav links
        navLinks.forEach(nav => nav.classList.remove('active'));
        // Hide all tab contents
        tabContents.forEach(content => content.classList.remove('active'));
        // Add active class to corresponding nav link
        const activeNavLink = document.querySelector(`[data-tab="${tabId}"]`);
        if (activeNavLink) {
            activeNavLink.classList.add('active');
        }
        // Show corresponding tab content
        const targetContent = document.getElementById(tabId);
        if (targetContent) {
            targetContent.classList.add('active');
        }
    }

    // Function to open mobile drawer
    function openMobileDrawer(tabId, tabTitle) {
        const targetContent = document.getElementById(tabId);
        if (targetContent) {
            // Clone the content for the drawer
            const clonedContent = targetContent.cloneNode(true);
            // Update drawer title and content
            drawerTitle.textContent = tabTitle;
            drawerBody.innerHTML = '';
            drawerBody.appendChild(clonedContent);
            
            // Special handling for wallet content
            if (tabId === 'wallet') {
                document.dispatchEvent(new Event("walletTabClick"));
                const walletDiv = drawerBody.querySelector('#wk_wallet');
                if (walletDiv) {
                    // Re-initialize wallet if needed
                }
                
            }
            
            // Show drawer with improved scroll handling
            mobileDrawer.classList.add('active');
            preventBodyScroll();
        } else {
            // Show fallback content
            drawerTitle.textContent = tabTitle;
            drawerBody.innerHTML = `
                <div class="content-header">
                    <h2 class="content-title">${tabTitle}</h2>
                    <p class="content-subtitle">Content not available at the moment.</p>
                </div>
                <div class="empty-state">
                    <p>This section is currently unavailable.</p>
                </div>
            `;
            mobileDrawer.classList.add('active');
            preventBodyScroll();
        }
    }

    // Function to close mobile drawer
    function closeMobileDrawer() {
        mobileDrawer.classList.remove('active');
        restoreBodyScroll();
    }

    // Handle button clicks (desktop navigation)
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Handle mobile nav item clicks
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    mobileNavItems.forEach(item => {
        item.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            const tabTitle = this.querySelector('.nav-item-text').textContent;
            
            // Add interaction class for temporary color change
            this.classList.add('interacting');
            // Remove interaction class after 200ms
            setTimeout(() => {
                this.classList.remove('interacting');
            }, 200);
            
            openMobileDrawer(tabId, tabTitle);
        });
    });

    // Handle drawer close
    if (drawerClose) {
        drawerClose.addEventListener('click', closeMobileDrawer);
    }

    // Handle overlay click
    if (drawerOverlay) {
        drawerOverlay.addEventListener('click', closeMobileDrawer);
    }

    // Handle escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && mobileDrawer.classList.contains('active')) {
            closeMobileDrawer();
        }
    });

    // Shopify requires authenticity_token on customer address POSTs; manual edit form must receive the same token as the add form (rendered via {% form %}).
    function syncAddressEditFormAuthenticityToken() {
        const addForm = document.getElementById('add-address-form');
        const editForm = document.getElementById('address-edit-form');
        if (!addForm || !editForm) return;
        const tokenEl = addForm.querySelector('input[name="authenticity_token"]');
        if (!tokenEl || !tokenEl.value) return;
        let editToken = editForm.querySelector('input[name="authenticity_token"]');
        if (!editToken) {
            editToken = document.createElement('input');
            editToken.type = 'hidden';
            editToken.name = 'authenticity_token';
            editForm.insertBefore(editToken, editForm.firstChild);
        }
        editToken.value = tokenEl.value;
    }

    // Address Edit and Delete Functionality
    const addressEditModal = document.getElementById('address-edit-modal');
    const addressDeleteModal = document.getElementById('address-delete-modal');
    const addAddressModal = document.getElementById('add-address-modal');
    const closeAddressModal = document.getElementById('close-address-modal');
    const closeDeleteModal = document.getElementById('close-delete-modal');
    const closeAddModal = document.getElementById('close-add-modal');
    const cancelAddressEdit = document.getElementById('cancel-address-edit');
    const cancelAddressDelete = document.getElementById('cancel-address-delete');
    const cancelAddAddress = document.getElementById('cancel-add-address');

    // Function to open address edit modal
    function openAddressEditModal(addressId) {
        // Find the address item with data attributes
        const addressItem = document.querySelector(`.address-item[data-address-id="${addressId}"]`);
        if (!addressItem) {
            showNotification('Address not found. Please refresh the page.', 'error');
            return;
        }

        // Read address data from data attributes (reliable, set by Liquid)
        const firstName = addressItem.dataset.firstName || '';
        const lastName = addressItem.dataset.lastName || '';
        const address1 = addressItem.dataset.address1 || '';
        const address2 = addressItem.dataset.address2 || '';
        const city = addressItem.dataset.city || '';
        const province = addressItem.dataset.province || '';
        const zip = addressItem.dataset.zip || '';
        const country = addressItem.dataset.country || '';
        const phone = addressItem.dataset.phone || '';

        // Populate form fields
        document.getElementById('edit-address-id').value = addressId;
        document.getElementById('edit-first-name').value = firstName;
        document.getElementById('edit-last-name').value = lastName;
        document.getElementById('edit-address1').value = address1;
        document.getElementById('edit-address2').value = address2;
        document.getElementById('edit-city').value = city;
        document.getElementById('edit-province').value = province;
        document.getElementById('edit-zip').value = zip;
        document.getElementById('edit-country').value = country;
        document.getElementById('edit-phone').value = phone;

        // Set the correct action URL for editing
        const editForm = document.getElementById('address-edit-form');
        editForm.action = `/account/addresses/${addressId}`;
        syncAddressEditFormAuthenticityToken();

        // Show modal with improved scroll handling
        addressEditModal.classList.add('active');
        preventBodyScroll();
    }

    // Function to open address delete modal
    function openAddressDeleteModal(addressId) {
        document.getElementById('delete-address-id').value = addressId;
        addressDeleteModal.classList.add('active');
        preventBodyScroll();
    }

    // Function to close modals
    function closeModals() {
        addressEditModal.classList.remove('active');
        addressDeleteModal.classList.remove('active');
        addAddressModal.classList.remove('active');
        restoreBodyScroll();
    }

    // Function to refresh addresses list (no longer needed since we don't refresh the page)
    function refreshAddressesList() {
        // This function is kept for potential future use but doesn't refresh the page
    }

    // Handle edit address button clicks
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('edit-address-btn')) {
            const addressId = e.target.getAttribute('data-address-id');
            openAddressEditModal(addressId);
        }
    });

    // Handle delete address button clicks
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('delete-address-btn')) {
            const addressId = e.target.getAttribute('data-address-id');
            openAddressDeleteModal(addressId);
        }
    });

    // Handle add new address button click
    document.addEventListener('click', function(e) {
        if (e.target.id === 'add-new-address-btn') {
            syncAddressEditFormAuthenticityToken();
            addAddressModal.classList.add('active');
            preventBodyScroll();
        }
    });

    syncAddressEditFormAuthenticityToken();

    // Handle edit profile button click
    document.addEventListener('click', function(e) {
        if (e.target.id === 'edit-profile-btn') {
            const editProfileModal = document.getElementById('edit-profile-modal');
            if (editProfileModal) {
                // Get current profile data (either from localStorage or from the page)
                const updatedProfileData = localStorage.getItem('updatedProfileData');
                let currentData = {};
                if (updatedProfileData) {
                    try {
                        currentData = JSON.parse(updatedProfileData);
                    } catch (error) {
                        // Handle error silently
                    }
                }

                // If no localStorage data, get from the page
                if (!currentData.firstName) {
                    const profileInfo = document.querySelector('.profile-info');
                    if (profileInfo) {
                        const nameField = profileInfo.querySelector('.profile-row:first-child .profile-field:first-child .field-value');
                        const emailField = profileInfo.querySelector('.profile-row:first-child .profile-field:last-child .field-value');
                        const phoneField = profileInfo.querySelector('.profile-row:nth-child(2) .profile-field .field-value');
                        if (nameField) {
                            const fullName = nameField.textContent.trim().split(' ');
                            currentData.firstName = fullName[0] || '';
                            currentData.lastName = fullName.slice(1).join(' ') || '';
                        }
                        if (emailField) {
                            currentData.email = emailField.textContent.trim();
                        }
                        if (phoneField) {
                            currentData.phone = phoneField.textContent.trim();
                        }
                    }
                }

                // Update the form fields with current data
                const form = editProfileModal.querySelector('#edit-profile-form');
                if (form) {
                    const firstNameInput = form.querySelector('#full-name');
                    const lastNameInput = form.querySelector('#last-name');
                    const emailInput = form.querySelector('#email');
                    const phoneInput = form.querySelector('#phone');
                    if (firstNameInput) firstNameInput.value = currentData.firstName || '';
                    if (lastNameInput) lastNameInput.value = currentData.lastName || '';
                    if (emailInput) emailInput.value = currentData.email || '';
                    if (phoneInput) phoneInput.value = currentData.phone || '';
                }

                editProfileModal.classList.add('active');
                preventBodyScroll();
            }
        }
    });

    // Handle address delete button click
    document.addEventListener('click', function(e) {
        if (e.target.closest('#address-delete-form') && e.target.type === 'submit') {
            e.preventDefault();
            e.stopPropagation();
            const form = e.target.closest('#address-delete-form');
            const addressId = form.querySelector('#delete-address-id').value;

            // Show loading state
            const submitBtn = e.target;
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Deleting...';
            submitBtn.disabled = true;

            // Create form data
            const formData = new FormData();
            formData.append('form_type', 'customer_address');
            formData.append('utf8', '✓');
            formData.append('_method', 'delete');
            formData.append('id', addressId);
            const csrf = document.querySelector('#add-address-form input[name="authenticity_token"]');
            if (csrf && csrf.value) {
                formData.append('authenticity_token', csrf.value);
            }

            fetch(`/account/addresses/${addressId}`, {
                method: 'POST',
                body: formData,
                credentials: 'same-origin',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => {
                if (response.ok || response.redirected) {
                    closeModals();
                    showNotification('Address deleted successfully!', 'success');
                    setTimeout(function() { window.location.reload(); }, 800);
                } else {
                    throw new Error('Failed to delete address');
                }
            })
            .catch(error => {
                showNotification('Failed to delete address. Please try again.', 'error');
            })
            .finally(() => {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            });
        }
    });

    // Handle address edit form submission (standard POST to hidden iframe)
    const editForm = document.getElementById('address-edit-form');
    if (editForm) {
        editForm.addEventListener('submit', function() {
            const submitBtn = this.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = 'Updating...';
                submitBtn.disabled = true;
            }

            // Ensure phone number is stored with +91 prefix but entered without code
            const phoneInput = this.querySelector('#edit-phone');
            if (phoneInput && phoneInput.value) {
                let raw = phoneInput.value.trim();
                // Remove all spaces
                raw = raw.replace(/\s+/g, '');
                // If it doesn't already start with '+', prefix +91
                if (raw && raw.charAt(0) !== '+') {
                    // Remove leading zeros before prefixing if any
                    raw = raw.replace(/^0+/, '');
                    phoneInput.value = '+91' + raw;
                }
            }

            window._addressFormSubmitted = 'edit';
        });
    }

    // Handle edit profile form submission
    document.addEventListener('submit', function(e) {
        if (e.target.id === 'edit-profile-form') {
            e.preventDefault();
            
            const form = e.target;
            const formData = new FormData();

            // Get form values
            const firstName = form.querySelector('#full-name').value.trim();
            const lastName = form.querySelector('#last-name').value.trim();
            const email = form.querySelector('#email').value.trim();
            const phone = form.querySelector('#phone').value.trim();

            // Show loading state
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Updating...';
            submitBtn.disabled = true;

            // Create form data for customer update
            formData.append('form_type', 'customer');
            formData.append('utf8', '✓');
            formData.append('customer[first_name]', firstName);
            formData.append('customer[last_name]', lastName);
            formData.append('customer[email]', email);
            formData.append('customer[phone]', phone);

            // Use AJAX to update customer profile without losing session
            fetch('/account', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => {
                // Log the response text for debugging
                return response.text().then(text => {
                    return { response, text };
                });
            })
            .then(({ response, text }) => {
                // Check if response is ok or if it's a redirect (which is normal for Shopify)
                if (response.ok || response.status === 302 || response.status === 200 || text.includes('success')) {
                    // Show success message
                    showNotification('Profile updated successfully!', 'success');

                    // Update the profile display on the page immediately
                    const profileInfo = document.querySelector('.profile-info');
                    if (profileInfo) {
                        // Update name
                        const nameField = profileInfo.querySelector('.profile-row:first-child .profile-field:first-child .field-value');
                        if (nameField) {
                            nameField.textContent = `${firstName} ${lastName}`.trim();
                        }
                        // Update email
                        const emailField = profileInfo.querySelector('.profile-row:first-child .profile-field:last-child .field-value');
                        if (emailField) {
                            emailField.textContent = email;
                        }
                        // Update phone - it's in the second profile-row
                        const phoneField = profileInfo.querySelector('.profile-row:nth-child(2) .profile-field .field-value');
                        if (phoneField) {
                            phoneField.textContent = phone;
                        }
                    }

                    // Store the updated data in localStorage to persist across page refreshes
                    localStorage.setItem('updatedProfileData', JSON.stringify({
                        firstName,
                        lastName,
                        email,
                        phone
                    }));

                    // Close modal
                    const editProfileModal = document.getElementById('edit-profile-modal');
                    if (editProfileModal) {
                        editProfileModal.classList.remove('active');
                    }
                    restoreBodyScroll();
                } else {
                    throw new Error(`Failed to update profile. Status: ${response.status}`);
                }
            })
            .catch(error => {
                showNotification('Failed to update profile. Please try again.', 'error');
            })
            .finally(() => {
                // Reset button state
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            });
        }
    });

    // Handle add new address form submission (standard POST to hidden iframe)
    const addForm = document.getElementById('add-address-form');
    if (addForm) {
        addForm.addEventListener('submit', function() {
            const submitBtn = this.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = 'Adding...';
                submitBtn.disabled = true;
            }

            // Ensure phone number is stored with +91 prefix but entered without code
            const phoneInput = this.querySelector('#add-phone');
            if (phoneInput && phoneInput.value) {
                let raw = phoneInput.value.trim();
                raw = raw.replace(/\s+/g, '');
                if (raw && raw.charAt(0) !== '+') {
                    raw = raw.replace(/^0+/, '');
                    phoneInput.value = '+91' + raw;
                }
            }

            window._addressFormSubmitted = 'add';
        });
    }

    // Listen for hidden iframe load to detect form submission completion
    const addressIframe = document.getElementById('address-form-target');
    if (addressIframe) {
        addressIframe.addEventListener('load', function() {
            if (window._addressFormSubmitted) {
                const type = window._addressFormSubmitted;
                window._addressFormSubmitted = null;
                closeModals();
                const message = type === 'edit'
                    ? 'Address updated successfully!'
                    : 'Address added successfully!';
                showNotification(message, 'success');
                setTimeout(function() { window.location.reload(); }, 800);
            }
        });
    }

    // Handle modal close buttons
    if (closeAddressModal) closeAddressModal.addEventListener('click', closeModals);
    if (closeDeleteModal) closeDeleteModal.addEventListener('click', closeModals);
    if (closeAddModal) closeAddModal.addEventListener('click', closeModals);
    if (cancelAddressEdit) cancelAddressEdit.addEventListener('click', closeModals);
    if (cancelAddressDelete) cancelAddressDelete.addEventListener('click', closeModals);
    if (cancelAddAddress) cancelAddAddress.addEventListener('click', closeModals);

    // Handle edit profile modal close
    const closeModal = document.getElementById('close-modal');
    const cancelEdit = document.getElementById('cancel-edit');
    
    if (closeModal) {
        closeModal.addEventListener('click', function() {
            const editProfileModal = document.getElementById('edit-profile-modal');
            if (editProfileModal) {
                editProfileModal.classList.remove('active');
            }
            restoreBodyScroll();
        });
    }
    
    if (cancelEdit) {
        cancelEdit.addEventListener('click', function() {
            const editProfileModal = document.getElementById('edit-profile-modal');
            if (editProfileModal) {
                editProfileModal.classList.remove('active');
            }
            restoreBodyScroll();
        });
    }

    // Handle modal overlay clicks
    if (addressEditModal) {
        addressEditModal.addEventListener('click', function(e) {
            if (e.target === addressEditModal) closeModals();
        });
    }
    
    if (addressDeleteModal) {
        addressDeleteModal.addEventListener('click', function(e) {
            if (e.target === addressDeleteModal) closeModals();
        });
    }
    
    if (addAddressModal) {
        addAddressModal.addEventListener('click', function(e) {
            if (e.target === addAddressModal) closeModals();
        });
    }

    // Handle edit profile modal overlay click
    const editProfileModal = document.getElementById('edit-profile-modal');
    if (editProfileModal) {
        editProfileModal.addEventListener('click', function(e) {
            if (e.target === editProfileModal) {
                editProfileModal.classList.remove('active');
                restoreBodyScroll();
            }
        });
    }

    // Handle escape key for modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (mobileDrawer.classList.contains('active')) {
                closeMobileDrawer();
            } else if (addressEditModal.classList.contains('active') || 
                      addressDeleteModal.classList.contains('active') || 
                      addAddressModal.classList.contains('active')) {
                closeModals();
            } else if (editProfileModal && editProfileModal.classList.contains('active')) {
                editProfileModal.classList.remove('active');
                restoreBodyScroll();
            }
        }
    });

    // Notification system
    function showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // Auto hide after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 5000);

        // Handle close button
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        });
    }
});