import {expect,test} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {WorkspaceNavigation,WorkspacePanel,ExpertPanel} from '../src/components/WorkspaceNavigation';
test('navigation exposes six focused views and one current page',()=>{
  const markup=renderToStaticMarkup(createElement(WorkspaceNavigation,{active:'phone',onChange:()=>{}}));
  expect((markup.match(/<button/g)||[])).toHaveLength(6);
  expect((markup.match(/aria-current="page"/g)||[])).toHaveLength(1);
  for(const title of ['Phone','Diagnostics','Files &amp; apps','Firmware','Advanced','History'])expect(markup).toContain(title);
});
test('unvisited views do not initialize their hidden tool content',()=>{
  const html=renderToStaticMarkup(createElement(WorkspacePanel,{view:'advanced',active:'phone',children:createElement('p',null,'LAB SECRET')}));
  expect(html).toBe('');
});
test('advanced sections start closed and defer expensive tool initialization',()=>{
  const html=renderToStaticMarkup(createElement(ExpertPanel,{id:'lab',title:'Lab',description:'Qualified tools',children:createElement('p',null,'NOT INITIALIZED')}));
  expect(html).toContain('<details');expect(html).not.toContain(' open=""');expect(html).not.toContain('NOT INITIALIZED');
});
test('an explicitly revealed section retains its original tool content',()=>{
  const html=renderToStaticMarkup(createElement(ExpertPanel,{id:'lab',title:'Lab',description:'Qualified tools',reveal:true,children:createElement('input',{defaultValue:'preserved'})}));
  expect(html).toContain('open=""');expect(html).toContain('value="preserved"');
});
