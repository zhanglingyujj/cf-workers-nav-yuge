import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSunPanelData } from '../src/frontend/bookmark-parsers.js';

const sunPanelExport = {
    version: 1,
    appName: 'Sun-Panel-Config',
    icons: [
        {
            title: '常用网站',
            sort: 5,
            children: [
                { title: 'Github', sort: 2, url: 'https://github.com/', description: '代码托管', icon: { itemType: 2, src: 'data:image/png;base64,xxx' } },
                { title: 'Google', sort: 1, url: 'https://google.com/', icon: null },
                { title: '重复', sort: 3, url: 'https://github.com/' },
                { title: '无URL', url: '' },
                { title: '非HTTP', url: 'javascript:alert(1)' },
            ],
        },
        { title: '自建服务', sort: 1, children: [{ title: '', url: 'http://nas.local:5000', lanUrl: 'https://nas.example.com' }] },
    ],
};

test('parseSunPanelData：分组按 sort 排序，字段映射正确', () => {
    const cats = parseSunPanelData(sunPanelExport);
    assert.deepEqual(Object.keys(cats), ['自建服务', '常用网站']);

    const [first] = cats['自建服务'];
    assert.equal(first.url, 'http://nas.local:5000');
    assert.equal(first.name, 'nas.local'); // 空 title 兜底用 hostname

    const links = cats['常用网站'];
    assert.equal(links.length, 2); // 重复、空 URL、非 http 均被过滤
    assert.equal(links[0].name, 'Google'); // children 按 sort 排序
    assert.equal(links[1].name, 'Github');
    assert.equal(links[1].tips, '代码托管');
    assert.equal(links[1].icon, 'data:image/png;base64,xxx');
    assert.equal(links[1].isPrivate, false);
});

test('parseSunPanelData：非 Sun-Panel 格式返回 null', () => {
    assert.equal(parseSunPanelData(null), null);
    assert.equal(parseSunPanelData({}), null);
    assert.equal(parseSunPanelData({ appName: 'Other', icons: [] }), null);
    assert.equal(parseSunPanelData({ appName: 'Sun-Panel-Config' }), null);
});

test('parseSunPanelData：url 缺失时回退 lanUrl', () => {
    const cats = parseSunPanelData({
        appName: 'Sun-Panel-Config',
        icons: [{ title: '内网', children: [{ title: 'NAS', url: '', lanUrl: 'https://nas.example.com' }] }],
    });
    assert.equal(cats['内网'][0].url, 'https://nas.example.com');
});
