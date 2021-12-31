import {render} from 'react-dom'
import * as React from 'react'

import {
    Routes,
    Route,
    HashRouter
  } from "react-router-dom";
const DefaultPage = React.lazy(() => import('./default'))
const GenerateAlarm = React.lazy(() => import('./generateAlarm'))


render(
    <HashRouter>
            <React.Suspense fallback={<div>fallback</div>} >

    <Routes>
      <Route path="/" element={<DefaultPage />} />
      <Route path="generate-alarm" element={<GenerateAlarm />} />
    </Routes>
    </React.Suspense>

  </HashRouter>,
    document.getElementById('root')
  );