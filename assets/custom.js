document.addEventListener("DOMContentLoaded", function() {
    
    // Function to fetch shop currency
    async function e() {
        try {
            // Use CartDataManager if available, otherwise fallback to direct fetch
            const cart = window.CartDataManager 
                ? await window.CartDataManager.getCart() 
                : await fetch("/cart.js").then(r => r.json());
            return cart.currency || "INR";
        } catch (e) {
            return "INR";
        }
    }
    
    // Function to fetch cart details
    function t() {
        const fetchPromise = window.CartDataManager 
            ? window.CartDataManager.getCart() 
            : fetch("/cart.js").then(r => r.json());
        
        fetchPromise
            .then(e => {
                let t = [];
                
                e.items.forEach((e, i) => {
                    let a = {
                        productId: e.sku,
                        variantId: e.variant_id,
                        productTitle: e.product_title,
                        variantTitle: e.variant_title,
                        quantity: e.quantity,
                        price: Math.round(e.price / 100),
                        finalPrice: Math.round(e.final_price / 100),
                        finalLinePrice: Math.round(e.final_line_price / 100),
                        image: e.image,
                        url: e.url,
                        variantOptions: e.variant_options || []
                    };
                    t.push(a);
                });
                
                if ("undefined" != typeof Moengage) {
                    Moengage.track_event("Cart Updated", {
                        "No. Of Products": e.item_count,
                        "Total Amount": Math.round(e.total_price / 100),
                        "Product Details": t
                    });
                }
                
                return {
                    cart: e,
                    productDetailsArray: t
                };
            })
            .catch(e => {});
    }
    
    // Function to fire cart view event
    function i() {
        const fetchPromise = window.CartDataManager 
            ? window.CartDataManager.getCart() 
            : fetch("/cart.js").then(r => r.json());
        
        fetchPromise
            .then(e => {
                let t = [];
                
                e.items.forEach((e, i) => {
                    let a = {
                        productId: e.sku,
                        variantId: e.variant_id,
                        productTitle: e.product_title,
                        variantTitle: e.variant_title,
                        quantity: e.quantity,
                        price: Math.round(e.price / 100),
                        finalPrice: Math.round(e.final_price / 100),
                        finalLinePrice: Math.round(e.final_line_price / 100),
                        image: e.image,
                        url: e.url,
                        variantOptions: e.variant_options || []
                    };
                    t.push(a);
                });
                
                if ("undefined" != typeof Moengage) {
                    Moengage.track_event("Cart Viewed", {
                        "No. Of Products": e.item_count,
                        "Total Amount": Math.round(e.total_price / 100),
                        "Product Details": t
                    });
                }
            })
            .catch(e => {});
    }
    
    // Function to track cart item removal
    async function a(t) {
        try {
            let i = await e();
            let a = {
                productId: t.querySelector(".cart-item__title a")?.href?.split("/products/")?.[1]?.split("?")?.[0] || "N/A",
                productName: t.querySelector(".cart-item__title a")?.textContent?.trim() || "N/A",
                categoryName: "N/A",
                categoryId: "N/A",
                quantity: parseInt(t.querySelector('input[name="updates[]"]')?.value || "1"),
                retailPrice: 0,
                discountPrice: 0,
                currency: i,
                image: t.querySelector(".cart-item__media img")?.src || "N/A",
                variantTitle: "N/A"
            };
            
            try {
                let cartData = window.CartDataManager 
                    ? await window.CartDataManager.getCart() 
                    : await fetch("/cart.js").then(r => r.json());
                let o = Array.from(t.parentElement.children).indexOf(t);
                let r = cartData.items[o];
                
                if (r) {
                    a.productId = r.sku;
                    a.productName = r.product_title || r.title || a.productName;
                    a.quantity = r.quantity || a.quantity;
                    a.retailPrice = parseFloat(r.compare_at_price || r.price || "0") / 100;
                    a.discountPrice = parseFloat(r.final_price || r.price || "0") / 100;
                    a.variantTitle = r.variant_title || r.title || "N/A";
                }
            } catch (c) {}
            
            let l = "N/A";
            let s = "N/A";
            
            if (a.variantTitle && "N/A" !== a.variantTitle) {
                let d = a.variantTitle.split("/").map(e => e.trim());
                if (d.length >= 2) {
                    l = d[0];
                    s = d[1];
                } else if (1 === d.length) {
                    s = d[0];
                }
            }
            
            if ("undefined" != typeof Moengage) {
                Moengage.track_event("Removed From Cart", {
                    "Product ID": a.productId,
                    "Product Name": a.productName,
                    "Category Name": a.categoryName,
                    "Category ID": a.categoryId,
                    Quantity: a.quantity,
                    "Retail Price": a.retailPrice.toFixed(2),
                    Discount: a.discountPrice.toFixed(2),
                    Currency: a.currency,
                    Color: l,
                    Size: s,
                    Image: a.image
                });
            }
        } catch (u) {}
    }
    
    // Function to handle coupon attempt
    async function n(e) {
        let t = e.target.closest(".sc_truck_submit, .apply-discount-button");
        
        if (t) {
            let i = t.closest("form");
            let a = i ? i.querySelector('input[placeholder*="Discount code"], input[name="code"], input[name="discount"]') : null;
            
            if (a && a.value.trim()) {
                let n = a.value.trim();
                
                if ("Remove" === t.textContent.trim()) {
                    return;
                }
                
                window.attemptedCouponCode = n;
                
                setTimeout(() => {
                    o(n);
                }, 2000);
            }
        }
    }
    
    // Function to check coupon result
    function o(e) {
        if (window.couponModalHandled && window.couponModalHandled === e) {
            delete window.attemptedCouponCode;
            delete window.couponModalHandled;
            return;
        }
        
        const fetchPromise = window.CartDataManager 
            ? window.CartDataManager.getCart(true) // Force refresh for coupon check
            : fetch("/cart.js").then(r => r.json());
        
        fetchPromise
            .then(t => {
                let i = false;
                let a = "";
                
                // Check if coupon was successfully applied
                if (t.cart_level_discount_applications && t.cart_level_discount_applications.length > 0) {
                    t.cart_level_discount_applications.forEach(t => {
                        if (t.title && t.title.toLowerCase().includes(e.toLowerCase())) {
                            i = true;
                            a = t.title;
                        }
                    });
                }
                
                // Also check item-level discounts
                if (!i && t.items) {
                    t.items.forEach(t => {
                        if (t.discounts && t.discounts.length > 0) {
                            t.discounts.forEach(t => {
                                if (t.title && t.title.toLowerCase().includes(e.toLowerCase())) {
                                    i = true;
                                    a = t.title;
                                }
                            });
                        }
                    });
                }
                
                // Fire appropriate event based on result
                if (!i && e) {
                    if ("undefined" != typeof Moengage) {
                        Moengage.track_event("Coupon Code Failed", {
                            "Coupon Code": e,
                            Reason: "Invalid or expired coupon code",
                            "Page Type": window.location.pathname.includes("/cart") ? "cart" : "other",
                            "User ID": window.customerId || "guest",
                            "User Type": window.customerTags || "guest"
                        });
                    }
                } else if (i && "undefined" != typeof Moengage) {
                    let n = 0;
                    let o = t.total_price / 100;
                    let r = 0;
                    
                    // Calculate original cart value
                    t.items.forEach(e => {
                        n += e.original_price * e.quantity / 100;
                    });
                    
                    // Calculate cart-level discounts
                    if (t.cart_level_discount_applications && t.cart_level_discount_applications.length > 0) {
                        r += t.cart_level_discount_applications.reduce((e, t) => e + t.total_allocated_amount, 0) / 100;
                    }
                    
                    // Calculate product-level discounts
                    t.items.forEach(e => {
                        if (e.original_price !== e.final_price) {
                            r += (e.original_price - e.final_price) * e.quantity / 100;
                        }
                    });
                    
                    Moengage.track_event("Coupon Code Applied", {
                        "Cart Value Before Discount": Math.round(n),
                        "Cart Value After Discount": Math.round(o),
                        "Coupon Code": a,
                        "Discount Amount": Math.round(r),
                        "Page Type": window.location.pathname.includes("/cart") ? "cart" : "other",
                        "User ID": window.customerId || "guest",
                        "User Type": window.customerTags || "guest"
                    });
                }
                
                delete window.attemptedCouponCode;
            })
            .catch(e => {
                delete window.attemptedCouponCode;
            });
    }
    
    // Cart view event listener
    if (document.addEventListener("cart:view", function(e) {
        i();
    }), "/cart" === window.location.pathname) {
        i();
    }
    
    // Cart updated event listener
    document.addEventListener("cart:updated", function(event) {
        // Helper function to process cart data
        function processCartData(cartData) {
            let i = 0;
            let a = 0;
            let n = "N/A";
            
            // Calculate original cart value
            cartData.items.forEach(item => {
                i += item.original_price * item.quantity / 100;
            });
            
            // Check for cart-level discounts
            if (cartData.cart_level_discount_applications && cartData.cart_level_discount_applications.length > 0) {
                a += cartData.cart_level_discount_applications.reduce((sum, discount) => sum + discount.total_allocated_amount, 0) / 100;
                n = cartData.cart_level_discount_applications.map(d => d.title).join(", ") || "N/A";
            }
            
            let o = 0;
            let r = [];
            
            // Check for product-level discounts
            cartData.items.forEach(item => {
                if (item.original_price !== item.final_price) {
                    o += (item.original_price - item.final_price) * item.quantity / 100;
                    
                    if (item.discounts && item.discounts.length > 0) {
                        item.discounts.forEach(discount => {
                            r.push(discount.title);
                        });
                    }
                    
                    if (item.line_level_discount_allocations && item.line_level_discount_allocations.length > 0) {
                        item.line_level_discount_allocations.forEach(alloc => {
                            if (alloc.discount_application && alloc.discount_application.title) {
                                r.push(alloc.discount_application.title);
                            }
                        });
                    }
                }
            });
            
            a += o;
            
            let c = [...new Set(r)];
            let l = c.length > 0 ? c.join(", ") : "N/A";
            let s = i - a;
            
            if (a > 0 && "undefined" != typeof Moengage) {
                Moengage.track_event("Coupon Code Applied", {
                    "Cart Value Before Discount": Math.round(i),
                    "Cart Value After Discount": Math.round(s),
                    "Discount Amount": Math.round(a),
                    "Coupon Code": l
                });
            }
            
            t();
        }
        
        // If cart data is provided in event, use it directly
        if (event.detail && event.detail.cart) {
            // Update cache with provided data
            if (window.CartDataManager) {
                window.CartDataManager.updateCache(event.detail.cart);
            }
            
            // Process the cart data directly without fetching
            processCartData(event.detail.cart);
        } else {
            // Fallback: fetch cart data if not provided in event
            const fetchPromise = window.CartDataManager 
                ? window.CartDataManager.getCart() 
                : fetch("/cart.js").then(r => r.json());
            
            fetchPromise
                .then(cartData => {
                    processCartData(cartData);
                })
                .catch(error => {
                    t();
                });
        }
    });
    
    // Cart item removal listeners
    document.addEventListener("click", async function(e) {
        let t = e.target.closest('.cart-item__remove, [is="cart-remove-item"]');
        if (t) {
            let i = t.closest(".cart-item");
            if (i) {
                await a(i);
            }
        }
    });
    
    document.addEventListener("click", function(e) {
        if (e.target.matches('[is="cart-remove-item"]')) {
            let t = e.target.closest(".cart-item");
            if (t) {
                a(t);
            }
        }
    });
    
    // Coupon code click handlers
    document.addEventListener("click", n);
    
    document.addEventListener("click", function(e) {
        if (e.target.closest(".apply-discount-button")) {
            n(e);
        }
    });
    
    document.addEventListener("click", async function(e) {
        let t = e.target.closest(".apply-discount-button");
        
        if (t) {
            if ("Remove" === t.textContent.trim()) {
                return;
            }
            
            let i = t.dataset.discountCode || t.dataset.code || "";
            
            if (!i) {
                let a = t.closest("form");
                let n = a ? a.querySelector('input[placeholder*="Coupon"], input[name="code"], input[name="discount"], #manualCouponInput') : null;
                
                if (n && n.value.trim()) {
                    i = n.value.trim();
                }
            }
            
            if (i) {
                window.attemptedCouponCode = i;
                
                setTimeout(() => {
                    o(i);
                }, 3000);
            }
        }
    });
    
    // Initialize customer ID and tags
    if (void 0 === window.customerId) {
        let r = document.querySelector('meta[name="customer-id"]');
        if (r) {
            window.customerId = r.getAttribute("content");
        }
        
        let c = document.querySelector('meta[name="customer-tags"]');
        if (c) {
            window.customerTags = c.getAttribute("content");
        }
    }
    
    // Begin checkout tracking function
    function l() {
        const fetchPromise = window.CartDataManager 
            ? window.CartDataManager.getCart() 
            : fetch("/cart.js").then(r => r.json());
        
        fetchPromise
            .then(e => {
                if (e.item_count > 0) {
                    let t = e.items.map(t => ({
                        item_id: t.product_id.toString(),
                        item_name: t.product_title,
                        item_variant: t.variant_title || "Default Title",
                        price: parseFloat((t.final_price / 100).toFixed(2)),
                        quantity: t.quantity,
                        currency: e.currency || "INR",
                        item_category: t.product_type || "General",
                        item_brand: t.vendor || "Unknown"
                    }));
                    
                    let i = parseFloat((e.total_price / 100).toFixed(2));
                    
                    if ("function" == typeof gtag) {
                        gtag("event", "begin_checkout", {
                            currency: e.currency || "INR",
                            value: i,
                            items: t,
                            page_type: document.body.getAttribute("data-page-type") || "unknown",
                            userID: document.body.getAttribute("data-user-id") || "guest",
                            user_type: document.body.getAttribute("data-user-type") || "guest"
                        });
                    }
                }
            })
            .catch(e => {});
    }
    
    // Variables for checkout tracking
    let s, d, u, p;
    
    // DOMContentLoaded event for checkout tracking
    if (document.addEventListener("DOMContentLoaded", function() {
        // Checkout button click tracking
        document.addEventListener("click", function(e) {
            let t = e.target.closest('[name="checkout"], [type="submit"][name="checkout"], .checkout-button, button[name="checkout"]');
            
            if (t) {
                let i = Date.now();
                
                if (i - u < 2000) {
                    return;
                }
                
                u = i;
                s = true;
                
                if (p) {
                    clearTimeout(p);
                }
                
                p = setTimeout(() => {
                    l();
                    s = false;
                }, 300);
            }
        });
        
        // Form submission tracking
        document.addEventListener("submit", function(e) {
            let t = e.target;
            
            if (t && (t.action.includes("/cart") || t.querySelector('[name="checkout"]'))) {
                let i = Date.now();
                
                if (!d && i - u >= 2000) {
                    u = i;
                    d = true;
                    l();
                    
                    setTimeout(() => {
                        d = false;
                    }, 3000);
                }
            }
        });
        
        // Express checkout buttons tracking
        let e = [
            ".paypal-button",
            ".apple-pay-button",
            ".google-pay-button",
            ".shopify-payment-button__button",
            '[data-testid="PayPalButtons"]',
            ".additional-checkout-button"
        ];
        
        e.forEach(e => {
            document.addEventListener("click", function(t) {
                if (t.target.closest(e)) {
                    let i = Date.now();
                    if (i - u >= 2000) {
                        u = i;
                        l();
                    }
                }
            });
        });
    }), document.addEventListener("click", function(e) {
        let t = e.target.closest('[name="checkout"], button[type="submit"][name="checkout"], .checkout-button');
        
        if (t) {
            const fetchPromise = window.CartDataManager 
                ? window.CartDataManager.getCart() 
                : fetch("/cart.js").then(r => r.json());
            
            fetchPromise
                .then(e => {
                    let t = [];
                    
                    e.items.forEach((e, i) => {
                        let a = {
                            productId: e.sku,
                            variantId: e.variant_id,
                            productTitle: e.product_title,
                            variantTitle: e.variant_title,
                            quantity: e.quantity,
                            price: Math.round(e.price / 100),
                            finalPrice: Math.round(e.final_price / 100),
                            finalLinePrice: Math.round(e.final_line_price / 100),
                            image: e.image,
                            url: e.url,
                            variantOptions: e.variant_options || []
                        };
                        t.push(a);
                    });
                    
                    if ("undefined" != typeof Moengage) {
                        Moengage.track_event("Begin Checkout", {
                            "No. Of Products": e.item_count,
                            "Total Amount": Math.round(e.total_price / 100),
                            "Product Details": t
                        });
                    }
                })
                .catch(e => {});
        }
    }), document.querySelector(".address__edit-address-button")?.addEventListener("click", async function(e) {
        e.preventDefault();
        if ("undefined" != typeof Moengage) {
            Moengage.track_event("Edit address", {
                Clicked: "Edited"
            });
        }
    }), document.querySelector(".address__delete_address_button")) {
        let b = document.querySelector(".address__delete_address_button");
        b && b.addEventListener("click", async function(e) {
            e.preventDefault();
            if ("undefined" != typeof Moengage) {
                Moengage.track_event("Delete address", {
                    Clicked: "Deleted"
                });
            }
        });
    }
    
    // Search input tracking
    let L = document.querySelector("input.search__input");
    if (L) {
        L.addEventListener("input", async function(e) {
            let t = e.target.value.trim();
            
            setTimeout(() => {
                let e = document.querySelectorAll('.predictive-search__list-item[role="option"]').length;
                
                if ("undefined" != typeof Moengage) {
                    if (t.length > 0) {
                        Moengage.track_event("Product Searched", {
                            "Search Keyword": t,
                            "Item Count": e
                        });
                    } else {
                        // Empty search
                    }
                }
            }, 500);
        });
    }
    
    // Filter form tracking
    document.querySelector(".face-form")?.addEventListener("change", function() {
        let e = document.querySelector('input[name="filter.v.price.gte"]');
        let t = document.querySelector('input[name="filter.v.price.lte"]');
        let i = e?.value || "0";
        let a = t?.value || t?.getAttribute("max") || "0";
        let n = document.querySelectorAll('input[name="filter.v.t.shopify.color-pattern"]:checked');
        let o = document.querySelectorAll('input[name="filter.v.t.shopify.size"]:checked');
        let r = document.querySelectorAll('input[name="filter.v.m.magento.sleeves"]:checked');
        
        let c = (e) => {
            let t = document.querySelector(`label[for="${e.id}"]`);
            return t ? t.textContent.trim().split("(")[0].trim() : "";
        };
        
        let l = (e) => {
            let t = Array.from(e).map(c);
            return [...new Set(t)];
        };
        
        let s = l(n).join(", ") || "Not selected";
        let d = l(o).join(", ") || "Not selected";
        let u = l(r).join(", ") || "Not selected";
        
        if ("undefined" != typeof Moengage) {
            Moengage.track_event("Filters", {
                sleeves: u,
                price: `₹${i} to ₹${a}`,
                size: d,
                color: s
            });
        }
    });
});

// ExpandableComponent class definition
class ExpandableComponent {
    constructor(e) {
        this.wrapper = e;
        this.toggles = e.querySelectorAll(".toggle-button");
        this.nestedToggles = e.querySelectorAll(".nested-toggle");
        this.initialize();
    }
    
    initialize() {
        this.toggles.forEach(e => {
            e.addEventListener("click", e => {
                this.handleToggle(e.target.closest(".toggle-button"));
            });
        });
        
        this.nestedToggles.forEach(e => {
            e.addEventListener("click", e => {
                e.stopPropagation();
                this.handleNestedToggle(e.target.closest(".nested-toggle"));
            });
        });
    }
    
    handleToggle(e) {
        let t = e.getAttribute("data-target");
        let i = document.getElementById(t);
        let a = e.querySelector(".expand-indicator");
        let n = e.classList.contains("expanded");
        
        if (this.collapseAllPanels(), n) {
            e.classList.remove("expanded");
            i.classList.remove("visible");
            a.classList.remove("rotated");
            i.style.maxHeight = "0px";
        } else {
            e.classList.add("expanded");
            i.classList.add("visible");
            a.classList.add("rotated");
            let o = i.scrollHeight;
            i.style.maxHeight = o + "px";
        }
    }
    
    handleNestedToggle(e) {
        let t = e.getAttribute("data-nested-target");
        let i = document.getElementById(t);
        let a = e.querySelector(".nested-indicator");
        
        if (e.classList.contains("expanded")) {
            e.classList.remove("expanded");
            i.classList.remove("visible");
            a.classList.remove("rotated");
            i.style.maxHeight = "0px";
            
            setTimeout(() => {
                this.updateParentAccordionHeight(e);
            }, 300);
        } else {
            e.classList.add("expanded");
            i.classList.add("visible");
            a.classList.add("rotated");
            let n = i.scrollHeight;
            i.style.maxHeight = n + "px";
            this.updateParentAccordionHeight(e);
        }
    }
    
    updateParentAccordionHeight(e) {
        let t = e.closest(".collapsible-panel");
        if (t && t.classList.contains("visible")) {
            let i = t.scrollHeight;
            t.style.maxHeight = i + "px";
        }
    }
    
    collapseAllPanels() {
        this.toggles.forEach(e => {
            let t = e.getAttribute("data-target");
            let i = document.getElementById(t);
            let a = e.querySelector(".expand-indicator");
            
            e.classList.remove("expanded");
            i.classList.remove("visible");
            a.classList.remove("rotated");
            i.style.maxHeight = "0px";
        });
        
        this.nestedToggles.forEach(e => {
            let t = e.getAttribute("data-nested-target");
            let i = document.getElementById(t);
            let a = e.querySelector(".nested-indicator");
            
            e.classList.remove("expanded");
            i.classList.remove("visible");
            a.classList.remove("rotated");
            i.style.maxHeight = "0px";
        });
    }
    
    expandPanel(e) {
        let t = document.querySelector(`[data-target="${e}"]`);
        if (t) {
            this.handleToggle(t);
        }
    }
    
    collapsePanel(e) {
        let t = document.querySelector(`[data-target="${e}"]`);
        let i = document.getElementById(e);
        let a = t.querySelector(".expand-indicator");
        
        if (t && t.classList.contains("expanded")) {
            t.classList.remove("expanded");
            i.classList.remove("visible");
            a.classList.remove("rotated");
            i.style.maxHeight = "0px";
        }
    }
    
    expandNestedPanel(e) {
        let t = document.querySelector(`[data-nested-target="${e}"]`);
        if (t) {
            this.handleNestedToggle(t);
        }
    }
    
    collapseNestedPanel(e) {
        let t = document.querySelector(`[data-nested-target="${e}"]`);
        let i = document.getElementById(e);
        let a = t.querySelector(".nested-indicator");
        
        if (t && t.classList.contains("expanded")) {
            t.classList.remove("expanded");
            i.classList.remove("visible");
            a.classList.remove("rotated");
            i.style.maxHeight = "0px";
            
            setTimeout(() => {
                this.updateParentAccordionHeight(t);
            }, 300);
        }
    }
}

// Auto login desktop function
function autoLoginDesk() {
    document.getElementById("kpuserdesktop").classList.add("kwik-pass-account-desk");
    document.getElementsByClassName("kwik-pass-account-desk")[0].addEventListener("click", function(e) {
        handleShopifyLogin(e, "/account");
    });
}

// Initialize expandable component
if (document.addEventListener("DOMContentLoaded", function() {
    let e = document.querySelector(".expandable-wrapper");
    if (e) {
        new ExpandableComponent(e);
    }
}), document.addEventListener("keydown", function(e) {
    if (e.target.classList.contains("toggle-button") && ("Enter" === e.key || " " === e.key)) {
        e.preventDefault();
        e.target.click();
    }
}), document.addEventListener("DOMContentLoaded", function() {
    // Wallet button tracking
    new MutationObserver(function() {
        let e = document.querySelector('.creditsyard-tab-content[data-tab-content="cashback"] a');
        
        if (e && !e.dataset.trackingBound) {
            e.dataset.trackingBound = "true";
            
            e.addEventListener("click", function() {
                let t = e.innerText.trim();
                let i = document.querySelector(".cashback-action-description")?.innerText.trim() || "";
                
                if ("function" == typeof gtag) {
                    gtag("event", "wallet_cta_click", {
                        cta_text: t,
                        section_name: "Wallet Cashback",
                        wallet_amount: i,
                        page_type: "{{ template | handleize }}",
                        userID: "{{ customer.id | default: 'guest' }}",
                        user_type: "{{ customer.tags | join: ',' | default: 'guest' }}"
                    });
                }

                if ("undefined" != typeof Moengage && "function" == typeof Moengage.track_event) {
                    Moengage.track_event("Wallet CTA Clicked", {
                        "CTA Text": t,
                        "Wallet Amount": i
                    });
                }
            });
        }
    }).observe(document.body, {
        childList: true,
        subtree: true
    });
}),

 window.addEventListener("user-loggedin", function(e) {
    let { token: t } = e?.detail;
    if (t) {
        autoLoginDesk();
    }
}), document.addEventListener("DOMContentLoaded", function() {
    if (localStorage.getItem("KWIKSESSIONTOKEN")) {
        autoLoginDesk();
    }
}), document.addEventListener("DOMContentLoaded", function() {
    // Read More/Less toggle
    let e = document.getElementById("toggleButton");
    let t = document.getElementById("shortText");
    let i = document.getElementById("fullText");

    if (e && t && i) {
        e.addEventListener("click", function() {
            let a = i.classList.contains("hidden");
            t.style.display = a ? "none" : "inline";
            i.classList.toggle("hidden");
            e.textContent = a ? "Read Less" : "Read More";
        });
    }
}), window.innerWidth <= 768) {
    // Wishlist redirect for mobile
    function e() {
        let e = document.querySelector(".wishlist-header-link a.wkh-button");
        if (!e) {
            return false;
        }
        if (!e.dataset.bound) {
            e.dataset.bound = "true";
            e.addEventListener("click", () => {
                sessionStorage.setItem("openWishlistTab", "true");
            });
        }
        if ("true" === sessionStorage.getItem("openWishlistTab")) {
            let t = document.querySelector('.mobile-nav-item[data-tab="wishlist"]');
            if (t) {
                t.click();
                sessionStorage.removeItem("openWishlistTab");
            }
        }
        return true;
    }
    let t = setInterval(() => {
        if (e()) {
            clearInterval(t);
        }
    }, 100);
}

// Variant Inventory Display Handler
document.addEventListener('DOMContentLoaded', function() {
    function updateInventoryDisplay(variantId) {
        const allInventoryTexts = document.querySelectorAll('.variant_inventory_main_text');
        allInventoryTexts.forEach(function(element) {
            element.style.display = 'none';
        });

        if (variantId) {
            const selectedInventoryText = document.querySelector(`.variant_inventory_main_text[data-variant-id="${variantId}"]`);
            if (selectedInventoryText) {
                const inventoryQty = parseInt(selectedInventoryText.getAttribute('data-inventory-qty'));
                if (inventoryQty <= 5) {
                    selectedInventoryText.style.display = 'block';
                }
            }
        }
    }

    document.addEventListener('variant:changed', function(event) {
        if (event.detail && event.detail.variant && event.detail.variant.id) {
            updateInventoryDisplay(event.detail.variant.id);
        }
    });

    document.addEventListener('change', function(event) {
        if (event.target.matches('.variant_inventory_main input[type="radio"]')) {
            const selectedInput = event.target;
            const variantInventoryMain = selectedInput.closest('.variant_inventory_main');
            if (variantInventoryMain) {
                const inventoryText = variantInventoryMain.querySelector('.variant_inventory_main_text');
                const allInventoryTexts = document.querySelectorAll('.variant_inventory_main_text');
                allInventoryTexts.forEach(function(element) {
                    element.style.display = 'none';
                });

                if (inventoryText) {
                    const inventoryQty = parseInt(inventoryText.getAttribute('data-inventory-qty'));
                    if (inventoryQty <= 5) {
                        inventoryText.style.display = 'block';
                    }
                }
            }
        }
    });

    const initiallyChecked = document.querySelector('.variant_inventory_main input[type="radio"]:checked');
    if (initiallyChecked) {
        const variantInventoryMain = initiallyChecked.closest('.variant_inventory_main');
        if (variantInventoryMain) {
            const inventoryText = variantInventoryMain.querySelector('.variant_inventory_main_text');
            if (inventoryText) {
                const inventoryQty = parseInt(inventoryText.getAttribute('data-inventory-qty'));
                if (inventoryQty <= 5) {
                    inventoryText.style.display = 'block';
                }
            }
        }
    }
});


//  sticky atc bar and select variant validation
// document.addEventListener("DOMContentLoaded", function() {
//     function handleStickyAddToCart(event) {
//         let stickyBtn = document.querySelector(".product-form__submit_sticky");
//         let viewBagBtn = document.querySelector("a.view_bag_text_button.btn");

//         let mainBtn = document.querySelector(".product-form__submit");
//         if (mainBtn) {
//             mainBtn.click();
//         }

//         if (stickyBtn) {
//             stickyBtn.style.display = "none";
//         }
//         if (viewBagBtn) {
//             viewBagBtn.style.display = "inline-flex";
//         }
//     }

//     function init() {
//         let stickyBtn = document.querySelector(".product-form__submit_sticky");
//         if (stickyBtn) {
//             stickyBtn.addEventListener("click", handleStickyAddToCart, true);
//         }
//     }

//     document.addEventListener("variant:changed", function(e) {
//         let stickyBtn = document.querySelector(".product-form__submit_sticky");
//         let viewBagBtn = document.querySelector("a.view_bag_text_button.btn");
//         if (stickyBtn) {
//             stickyBtn.style.display = "inline-flex";
//             if (e.detail && e.detail.variant) {
//                 let btnSpan = stickyBtn.querySelector("span");
//                 if (e.detail.variant.available === false) {
//                     stickyBtn.disabled = true;
//                     if (!stickyBtn.dataset.originalText && btnSpan) {
//                         stickyBtn.dataset.originalText = btnSpan.textContent;
//                     }
//                     if (btnSpan) {
//                         btnSpan.textContent = "Out of Stock";
//                     }
//                 } else {
//                     stickyBtn.disabled = false;
//                     if (btnSpan && stickyBtn.dataset.originalText) {
//                         btnSpan.textContent = stickyBtn.dataset.originalText;
//                     }
//                 }
//             }
//         }
//         if (viewBagBtn) {
//             viewBagBtn.style.display = "none";
//         }
//     });
//     init();
//     setTimeout(init, 1000);
//     setTimeout(init, 2000);
// });

document.addEventListener("DOMContentLoaded", function() {
    function handleStickyAddToCart(event) {
        let stickyBtn = document.querySelector(".product-form__submit_sticky");
        let viewBagBtn = document.querySelector("a.view_bag_text_button.btn");
        let mainBtn = document.querySelector(".product-form__submit");
        
        // Add loading class to sticky button
        if (stickyBtn) {
            stickyBtn.classList.add("btn--loading");
        }
        
        // Trigger main button click
        if (mainBtn) {
            mainBtn.click();
        }

        // Wait for a few seconds before hiding sticky and showing view bag
        setTimeout(function() {
            if (stickyBtn) {
                stickyBtn.classList.remove("btn--loading"); // Remove loading class
                stickyBtn.style.display = "none";
            }
            if (viewBagBtn) {
                viewBagBtn.style.display = "inline-flex";
            }
        }, 2500);
    }

    function init() {
        let stickyBtn = document.querySelector(".product-form__submit_sticky");
        if (stickyBtn) {
            stickyBtn.addEventListener("click", handleStickyAddToCart, true);
        }
    }

    document.addEventListener("variant:changed", function(e) {
        let stickyBtn = document.querySelector(".product-form__submit_sticky");
        let viewBagBtn = document.querySelector("a.view_bag_text_button.btn");
        
        if (stickyBtn) {
            stickyBtn.style.display = "inline-flex";
            stickyBtn.classList.remove("btn--loading"); // Ensure loading class is removed on variant change
            
            if (e.detail && e.detail.variant) {
                let btnSpan = stickyBtn.querySelector("span");
                if (e.detail.variant.available === false) {
                    stickyBtn.disabled = true;
                    if (!stickyBtn.dataset.originalText && btnSpan) {
                        stickyBtn.dataset.originalText = btnSpan.textContent;
                    }
                    if (btnSpan) {
                        btnSpan.textContent = "Out of Stock";
                    }
                } else {
                    stickyBtn.disabled = false;
                    if (btnSpan && stickyBtn.dataset.originalText) {
                        btnSpan.textContent = stickyBtn.dataset.originalText;
                    }
                }
            }
        }
        if (viewBagBtn) {
            viewBagBtn.style.display = "none";
        }
    });

    init();
    setTimeout(init, 1000);
    setTimeout(init, 2000);
});
//  sticky atc bar and select variant validation

// Scroll to discount section when clicking on know_how_text
document.addEventListener("DOMContentLoaded", function() {
    const knowHowElements = document.querySelectorAll(".know_how_text");
    knowHowElements.forEach(function(element) {
        element.addEventListener("click", function(event) {
            event.preventDefault();
            const targetSection = document.querySelector("#redirecttodiscount");
            if (targetSection) {
                const headerOffset = 100;
                const elementPosition = targetSection.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            }
        });
    });
});

document.querySelectorAll('.product_top_starrating').forEach(function(el) {
  el.addEventListener('click', function() {
    var target = document.getElementById('looxReviews');
    if (target) {
      var offset = 100; 
      var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: top, behavior: 'smooth' });
    }
  });
});

(function() {
    if (!window.location.pathname.includes('/collections/')) return;

    function enforceAvailabilityFilter() {
        var inStock = document.querySelector('input[name="filter.v.availability"][value="1"]');
        var outOfStock = document.querySelector('input[name="filter.v.availability"][value="0"]');
        
        if (inStock) inStock.checked = true;
        if (outOfStock) {
            outOfStock.disabled = true;
            outOfStock.checked = false;
            var li = outOfStock.closest('li');
            if (li) {
                li.style.opacity = '0.5';
                li.style.pointerEvents = 'none';
            }
        }
    }

    // Prevent unchecking "In Stock" filter
    document.addEventListener('click', function(e) {
        var inStock = document.querySelector('input[name="filter.v.availability"][value="1"]');
        if (!inStock) return;
        
        var label = document.querySelector('label[for="' + inStock.id + '"]');
        var clickedInStockArea = e.target === inStock || e.target === label || (label && label.contains(e.target));
        
        if (clickedInStockArea && inStock.checked) {
            e.preventDefault();
            e.stopPropagation();
            inStock.checked = true;
        }
    }, true);

    // Re-apply after AJAX filter updates
    document.addEventListener('collection:rerendered', enforceAvailabilityFilter);
    
    // Initial enforcement on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enforceAvailabilityFilter);
    } else {
        enforceAvailabilityFilter();
    }
})();
