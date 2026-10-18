import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
const xml=readFileSync(new URL('../src-tauri/entitlements.mac.plist',import.meta.url),'utf8');
const enabled=key=>new RegExp('<key>'+key.replaceAll('.','\\.')+'</key>\\s*<true\\s*/>').test(xml);
test('sandboxed WKWebView has client networking while App Sandbox remains enabled',()=>{
 expect(enabled('com.apple.security.app-sandbox')).toBe(true);
 expect(enabled('com.apple.security.network.client')).toBe(true);
});
test('GUI startup fix does not request server networking or unsigned executable memory',()=>{
 expect(enabled('com.apple.security.network.server')).toBe(false);
 expect(enabled('com.apple.security.cs.allow-unsigned-executable-memory')).toBe(false);
});
