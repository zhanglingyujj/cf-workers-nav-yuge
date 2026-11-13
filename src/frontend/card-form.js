// card-form.js - 卡片表单字段读写的单一出处（依赖注入工厂，纯读写，不依赖 overlay）
// 新增卡片字段时只需改这里的字段清单 + index.html 表单 + card.js 渲染
import { getEl } from './utils.js';

export function createCardForm({ query = getEl } = {}) {
    const q = query;

    function writeCategory(category) {
        const catValue = q('category-select-value');
        const catText = q('category-select-text');
        if (catValue) catValue.value = category;
        if (catText) catText.textContent = category || '请选择分类';
    }

    function writeBgColor(color) {
        const input = q('bg-color-input');
        if (input) input.value = color || '';
        const swatches = q('bg-color-swatches');
        if (swatches && swatches.querySelectorAll) {
            swatches.querySelectorAll('button').forEach(b => { b.style.outline = ''; });
        }
    }

    function readBgColor() {
        const input = q('bg-color-input');
        const v = (input && input.value.trim()) || '';
        return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) ? v : '';
    }

    const readForm = () => {
        const privateCheckbox = q('private-checkbox');
        return {
            name: ((q('name-input') || {}).value || '').trim(),
            url: ((q('url-input') || {}).value || '').trim(),
            tips: ((q('tips-input') || {}).value || '').trim(),
            icon: ((q('icon-input') || {}).value || '').trim(),
            backgroundColor: readBgColor(),
            category: ((q('category-select-value') || {}).value || ''),
            isPrivate: !!(privateCheckbox && privateCheckbox.checked),
        };
    };

    return {
        writeForm(link, categoryName) {
            const nameInput = q('name-input');
            const urlInput = q('url-input');
            const tipsInput = q('tips-input');
            const iconInput = q('icon-input');
            const privateCheckbox = q('private-checkbox');
            if (nameInput) nameInput.value = link.name;
            if (urlInput) urlInput.value = link.url;
            if (tipsInput) tipsInput.value = link.tips || '';
            if (iconInput) iconInput.value = link.icon || '';
            writeBgColor(link.backgroundColor || '');
            if (privateCheckbox) privateCheckbox.checked = !!link.isPrivate;
            writeCategory(categoryName || link.category || '');
        },
        readForm,
        clearForm(categoryName = '') {
            const nameInput = q('name-input');
            const urlInput = q('url-input');
            const tipsInput = q('tips-input');
            const iconInput = q('icon-input');
            const privateCheckbox = q('private-checkbox');
            if (nameInput) nameInput.value = '';
            if (urlInput) urlInput.value = '';
            if (tipsInput) tipsInput.value = '';
            if (iconInput) iconInput.value = '';
            writeBgColor('');
            if (privateCheckbox) privateCheckbox.checked = false;
            writeCategory(categoryName);
        },
        validate() {
            const { name, url, category } = readForm();
            if (!name || !url || !category) return '请填写必要信息 (名称, URL, 分类)';
            return null;
        },
    };
}
