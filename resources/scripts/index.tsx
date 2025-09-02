import React from 'react';
import ReactDOM from 'react-dom';
import App from '@/components/App';
import { setConfig } from 'react-hot-loader';

// Enable language support.
import './i18n';

// Prevents page reloads while making component changes which
// also avoids triggering constant loading indicators all over
// the place in development.
//
// @see https://github.com/gaearon/react-hot-loader#hook-support
setConfig({ reloadHooks: false });

ReactDOM.render(<App />, document.getElementById('app'));

// 这条信息你不可以将之删除，一是记录了版本信息，二是为了原项目指向，如果你将之删除，那你需要承担相应的责任。否则请不要使用我们的汉化！
console.log("\n %c pterodactyl-china " + " %c https://github.com/pterodactyl-china/panel \n\n", "background: #35495e; padding: 1px; border-radius: 3px 0 0 3px; color: #fff", "background: #fadfa3; padding: 1px; border-radius: 0 3px 3px 0; color: #fff");
