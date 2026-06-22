window.addEventListener("load",function(){if(sessionStorage.getItem("moengageSessionTracked"))return;let e=new Date().toISOString(),t=function e(){let t=new URLSearchParams(window.location.search);return{utm_source:t.get("utm_source")||"",utm_medium:t.get("utm_medium")||"",utm_campaign:t.get("utm_campaign")||"",utm_term:t.get("utm_term")||"",utm_content:t.get("utm_content")||""}}(),n=function e(){let t=navigator.userAgent;return/mobile/i.test(t)?"Mobile":/tablet/i.test(t)?"Tablet":"Desktop"}();Moengage.track_event("Session Started",{event_time:e,device:n,utm:t}),sessionStorage.setItem("moengageSessionTracked","true")});
document.addEventListener("DOMContentLoaded",()=>{let e=document.querySelector(".wishlist-header-link .wkh-button");e&&e.addEventListener("click",e=>{e.preventDefault(),window.location.href="/account?tab=wishlist"})});
window.onload=function(){fetch("/cart.js").then(t=>t.json()).then(t=>{if(0===t.item_count&&t.token){let o={id:`gid://shopify/Cart/${t.token}`,discountCodes:[]},e=`
          mutation cartDiscountCodesUpdate($id: ID!, $discountCodes:[String!]) {
            cartDiscountCodesUpdate(cartId: $id, discountCodes: $discountCodes) {
              cart {
                id
                discountCodes {
                  code
                  applicable
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `;fetch("https://powerlook-apparels.myshopify.com/api/2024-10/graphql.json",{method:"POST",headers:{"Content-Type":"application/json","x-shopify-storefront-access-token":"df3b1660e6859f510b854dc282eccdf9"},body:JSON.stringify({query:e,variables:o})}).then(t=>t.json()).then(t=>{let o=t?.data?.cartDiscountCodesUpdate?.userErrors;if(o?.length>0)return}).catch(t=>{})}}).catch(t=>{})};