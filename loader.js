// Loader functionality for PDF to Excel Converter
(function() {
    function setupLoaderHandlers() {
        const cssLoader = document.getElementById('cssLoader');
        const spinner = document.getElementById('spinner');
        const blurOverlay = document.getElementById('blurOverlay');
        const demoBtn = document.getElementById('demoBtn');

        // Observer for spinner display changes
        if (spinner && cssLoader) {
            const observer = new MutationObserver(() => {
                if (spinner.style.display !== 'none') {
                    cssLoader.style.display = 'block';
                } else {
                    cssLoader.style.display = 'none';
                }
            });
            observer.observe(spinner, { attributes: true, attributeFilter: ['style'] });
        }

        // Blur overlay handling
        if (demoBtn) {
            demoBtn.addEventListener('click', () => {
                blurOverlay.classList.add('active');
            });
        }

        // Processing events
        window.addEventListener('processing-start', () => {
            if (blurOverlay) {
                blurOverlay.classList.add('active');
                startSmoothProgress();
            }
        });
        
        window.addEventListener('processing-end', () => {
            if (blurOverlay) {
                stopSmoothProgress();
                blurOverlay.classList.remove('active');
            }
        });

        // Smooth progress animation
        let progressInterval;
        const dots = document.querySelectorAll('.dot');
        
        function startSmoothProgress() {
            let currentDot = 0;
            dots.forEach(dot => dot.classList.remove('active'));
            
            progressInterval = setInterval(() => {
                dots.forEach(dot => dot.classList.remove('active'));
                dots[currentDot].classList.add('active');
                currentDot = (currentDot + 1) % dots.length;
            }, 600);
        }
        
        function stopSmoothProgress() {
            clearInterval(progressInterval);
            dots.forEach(dot => dot.classList.add('active'));
        }
    }

    // Wait for DOM to be ready and setup handlers
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', setupLoaderHandlers);
    } else {
        setupLoaderHandlers();
    }
})();
