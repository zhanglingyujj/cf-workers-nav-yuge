// card-form.test.js - createCardForm 依赖注入工厂：fake query 纯对象，覆盖读写往返 / 清空 / 校验
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCardForm } from '../src/frontend/card-form.js';

const MISSING_MSG = '请填写必要信息 (名称, URL, 分类)';

function makeHarness() {
    const fields = {
        'name-input': { value: '' },
        'url-input': { value: '' },
        'tips-input': { value: '' },
        'icon-input': { value: '' },
        'bg-color-input': { value: '' },
        'bg-color-swatches': {
            buttons: [{ style: { outline: '' } }],
            querySelectorAll() { return this.buttons; },
        },
        'category-select-value': { value: '' },
        'category-select-text': { textContent: '' },
        'private-checkbox': { checked: false },
    };
    const form = createCardForm({ query: id => fields[id] });
    return { form, fields };
}

test('writeForm → readForm 往返：字段值一致，空白被 trim，分类可由 categoryName 覆盖', () => {
    const { form } = makeHarness();
    form.writeForm({
        name: '  Example  ',
        url: ' https://example.com ',
        tips: ' 一个站点 ',
        icon: ' https://example.com/i.png ',
        backgroundColor: '#1e293bd9',
        category: 'Tools',
        isPrivate: true,
    }, 'Dev');
    const out = form.readForm();
    assert.equal(out.name, 'Example');
    assert.equal(out.url, 'https://example.com');
    assert.equal(out.tips, '一个站点');
    assert.equal(out.icon, 'https://example.com/i.png');
    assert.equal(out.backgroundColor, '#1e293bd9');
    assert.equal(out.category, 'Dev');
    assert.equal(out.isPrivate, true);
});

test('writeForm 未传 categoryName 时回退 link.category', () => {
    const { form, fields } = makeHarness();
    form.writeForm({ name: 'a', url: 'u', category: 'Tools' });
    assert.equal(fields['category-select-value'].value, 'Tools');
    assert.equal(fields['category-select-text'].textContent, 'Tools');
});

test('readForm 丢弃非法 backgroundColor，isPrivate 缺省为 false', () => {
    const { form, fields } = makeHarness();
    form.writeForm({ name: 'a', url: 'u', category: 'Tools', backgroundColor: 'not-a-color' });
    assert.equal(form.readForm().backgroundColor, '');

    fields['bg-color-input'].value = '#FFF';
    assert.equal(form.readForm().backgroundColor, '#FFF');

    fields['bg-color-input'].value = '#11223344';
    assert.equal(form.readForm().backgroundColor, '#11223344');

    assert.equal(form.readForm().isPrivate, false);
});

test('writeForm 清空色板高亮', () => {
    const { form, fields } = makeHarness();
    fields['bg-color-swatches'].buttons[0].style.outline = '2px solid #27272A';
    form.writeForm({ name: 'a', url: 'u', category: 'Tools', backgroundColor: '' });
    assert.equal(fields['bg-color-swatches'].buttons[0].style.outline, '');
});

test('clearForm 清空全部字段，分类回落占位文案', () => {
    const { form, fields } = makeHarness();
    form.writeForm({
        name: 'a', url: 'u', tips: 't', icon: 'i',
        backgroundColor: '#B8422Ed9', category: 'Tools', isPrivate: true,
    });
    form.clearForm();
    assert.deepEqual(form.readForm(), {
        name: '', url: '', tips: '', icon: '',
        backgroundColor: '', category: '', isPrivate: false,
    });
    assert.equal(fields['category-select-text'].textContent, '请选择分类');
});

test('clearForm(preset) 预选分组', () => {
    const { form, fields } = makeHarness();
    form.clearForm('Dev');
    assert.equal(fields['category-select-value'].value, 'Dev');
    assert.equal(fields['category-select-text'].textContent, 'Dev');
});

test('validate：缺名称/URL/分类各返回错误文案，齐全返回 null', () => {
    const full = { name: 'a', url: 'u', category: 'Tools' };

    const missingName = makeHarness();
    missingName.form.writeForm({ ...full, name: '' });
    assert.equal(missingName.form.validate(), MISSING_MSG);

    const missingUrl = makeHarness();
    missingUrl.form.writeForm({ ...full, url: '' });
    assert.equal(missingUrl.form.validate(), MISSING_MSG);

    const missingCategory = makeHarness();
    missingCategory.form.writeForm({ name: 'a', url: 'u' });
    missingCategory.fields['category-select-value'].value = '';
    assert.equal(missingCategory.form.validate(), MISSING_MSG);

    const ok = makeHarness();
    ok.form.writeForm(full);
    assert.equal(ok.form.validate(), null);
});
