if (!customElements.get('variant-selects')) {

  customElements.define(
    'variant-selects',
    class VariantSelects extends HTMLElement {
      constructor() {
        super();
      }
      get selectedOptionValues() {
        return Array.from(this.querySelectorAll('select option[selected], fieldset input:checked')).map(
          ({ dataset }) => dataset.optionValueId
        );
      }
      getInputForEventTarget(target) {
        return target.tagName === 'SELECT' ? target.selectedOptions[0] : target;
      }

      connectedCallback() {
        this.addEventListener('change', (event) => {
          const target = this.getInputForEventTarget(event.target);
          this.updateSelectedSwatchValue(event);
          this.updateSelectedSizeDetails();
          this.updateVariantId();
          FoxTheme.pubsub.publish(FoxTheme.pubsub.PUB_SUB_EVENTS.optionValueSelectionChange, {
            data: {
              event,
              target,
              selectedOptionValues: this.selectedOptionValues,
            },
          });
        });
        this.updateSelectedSizeDetails();
      }

      hideValueIfNoVariantChecked() {
        // Check all product form inputs
        this.querySelectorAll('.product-form__input').forEach(formInput => {
          // Check if any radio input is checked
          const hasCheckedRadio = formInput.querySelector('input[type="radio"]:checked');
          // Check if any select has a selected option
          const select = formInput.querySelector('select');
          const hasSelectedOption = select && select.querySelector('option[selected]');

          // If no variant is checked, clear the display value
          if (!hasCheckedRadio && !hasSelectedOption) {
            const selectedSwatchValue = formInput.querySelector('[data-selected-swatch-value], [data-selected-value]');
            if (selectedSwatchValue) {
              selectedSwatchValue.innerHTML = '';
            }
          }
        });
      }

      normalizeSizeLabel(value) {
        const sizeMap = {
          XXL: '2XL',
          XXXL: '3XL',
          XXXXL: '4XL',
          XXXXXL: '5XL',
        };
        return sizeMap[value] || value;
      }

      getDisplayLabel(value, optionName = '') {
        if (optionName.toLowerCase() === 'size') {
          return this.normalizeSizeLabel(value);
        }
        return value;
      }

      escapeHTML(value = '') {
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

	      updateSelectedSizeDetails() {
	        const fallbackSizeFormInput = this.querySelector('.product-form__input[data-option-name*="size"]');

	        this.querySelectorAll('[data-selected-size-details]').forEach((detailsNode) => {
	          const formInput = detailsNode.closest('.product-form__input') || fallbackSizeFormInput;
	          if (!formInput) return;
	
	          let sourceNode = formInput.querySelector('input[type="radio"]:checked');
	          if (!sourceNode) {
	            const select = formInput.querySelector('select');
            if (select && select.selectedOptions.length) sourceNode = select.selectedOptions[0];
          }

          if (!sourceNode) {
            detailsNode.textContent = '';
            detailsNode.hidden = true;
            return;
          }

          const parts = [];
          const mappings = [
            ['sizeChartChest', 'Chest'],
            ['sizeChartWaist', 'Waist'],
          ];

          mappings.forEach(([datasetKey, label]) => {
            const value = sourceNode.dataset[datasetKey];
            if (value) parts.push(`${label}: ${this.escapeHTML(value)} in`);
          });
          detailsNode.innerHTML = parts.join('&nbsp;&nbsp;&nbsp;');
          detailsNode.hidden = parts.length === 0;
        });
      }

      updateSelectedSwatchValue({ target }) {
        const { value, tagName } = target;
        if (tagName === 'SELECT' && target.selectedOptions.length) {
          Array.from(target.options)
            .find((option) => option.getAttribute('selected'))
            .removeAttribute('selected');
          target.selectedOptions[0].setAttribute('selected', 'selected');
          const swatchValue = target.selectedOptions[0].dataset.optionSwatchValue;
          const selectedDropdownSwatchValue = target
            .closest('.product-form__input')
            .querySelector('[data-selected-value] > .swatch');
          if (selectedDropdownSwatchValue) {
            if (swatchValue) {
              selectedDropdownSwatchValue.style.setProperty('--swatch--background', swatchValue);
              selectedDropdownSwatchValue.classList.remove('swatch--unavailable');
            } else {
              selectedDropdownSwatchValue.style.setProperty('--swatch--background', 'unset');
              selectedDropdownSwatchValue.classList.add('swatch--unavailable');
            }
            selectedDropdownSwatchValue.style.setProperty(
              '--swatch-focal-point',
              target.selectedOptions[0].dataset.optionSwatchFocalPoint || 'unset'
            );
          }
          const selectedTextNode = target.closest('.product-form__input').querySelector('[data-selected-swatch-value]');
          if (selectedTextNode) {
            const optionName = selectedTextNode.dataset.selectedSwatchValue || '';
            selectedTextNode.innerHTML = this.getDisplayLabel(target.selectedOptions[0].value, optionName);
          }
        } else if (tagName === 'INPUT' && target.type === 'radio') {
          // Update checked attribute for selected variant
          const formInput = target.closest('.product-form__input');
          const radioName = target.name;
          const allRadios = Array.from(formInput.querySelectorAll('input[type="radio"]')).filter(radio => radio.name === radioName);
          allRadios.forEach(radio => {
            if (radio === target) {
              radio.setAttribute('checked', 'checked');
            } else {
              radio.removeAttribute('checked');
            }
          });

          const selectedSwatchValue = formInput.querySelector('[data-selected-swatch-value], [data-selected-value]');
          if (selectedSwatchValue) {
            const optionName = selectedSwatchValue.dataset.selectedSwatchValue || '';
            selectedSwatchValue.innerHTML = this.getDisplayLabel(value, optionName);
          }
        }
      }

      getVariantData() {
        const variantScript = this.querySelector('[data-product-variants]');
        if (!variantScript) return null;
        try {
          return JSON.parse(variantScript.textContent);
        } catch (e) {
          return null;
        }
      }

      getSelectedOptionStrings() {
        const selectedValues = [];
        this.querySelectorAll('.product-form__input').forEach(formInput => {
          const checkedRadio = formInput.querySelector('input[type="radio"]:checked');
          if (checkedRadio) {
            selectedValues.push(checkedRadio.value);
            return;
          }
          const select = formInput.querySelector('select');
          if (select && select.value) {
            selectedValues.push(select.value);
            return;
          }
          selectedValues.push(null);
        });
        return selectedValues;
      }

      updateVariantId() {
        const variants = this.getVariantData();
        if (!variants) return;
        const selectedValues = this.getSelectedOptionStrings();
        if (!selectedValues.length || selectedValues.includes(null)) return;
        const matchingVariant = variants.find(variant =>
          selectedValues.every((value, index) => variant[`option${index + 1}`] === value)
        );
        if (!matchingVariant) return;
        const sectionId = this.dataset.section;
        document.querySelectorAll(`#product-form-${sectionId}, #product-form-installment-${sectionId}`)
          .forEach(form => {
            const idInput = form.querySelector('input[name="id"]');
            if (idInput) idInput.value = matchingVariant.id;
          });
      }
    }
  );
}
