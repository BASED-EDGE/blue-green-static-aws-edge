/**
 * AGGRESSIVELY chunk everything into async chunks
 * want to keep the index.js as small as possible since it will not be cached
 */
function main() {
  Promise.all([
    import('react'),
    import('react-router-dom'),
    import('react-dom'),
  ]).then(([
    { default: React },
    { 
      Routes,
      Route,
      HashRouter
     },
    { render }
  ]) => {
    const DefaultPage = React.lazy(() => import('./default'))
    const GenerateAlarm = React.lazy(() => import('./generateAlarm'))

    render(<div>
        <h1>sample react app</h1>
        <HashRouter>
          <React.Suspense fallback={<div>loading chunk....</div>} >
            <Routes>
              <Route path="/" element={<DefaultPage />} />
              <Route path="generate-alarm" element={<GenerateAlarm />} />
            </Routes>
          </React.Suspense>
        </HashRouter>
      </div>,
      document.getElementById('root')
    )
  })
}

main()