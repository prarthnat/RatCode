// Initialize the AngularJS application module
var app = angular.module('codeQualityApp', []);

// Define the main controller for handling UI logic and API calls
app.controller('CodeQualityController', ['$scope', '$http', function($scope, $http) {
    // Model for the code input textarea
    $scope.codeToAnalyze = '';
    // Model for storing the analysis results
    $scope.analysisResult = null;
    // Message for user feedback (e.g., loading, error)
    $scope.message = '';
    // Flag to indicate if analysis is in progress
    $scope.analyzing = false;

    /**
     * Function to trigger code analysis.
     * It sends the code to a hypothetical backend and updates the UI with results.
     */
    $scope.analyzeCode = function() {
        // Basic validation: ensure code input is not empty
        if (!$scope.codeToAnalyze.trim()) {
            $scope.message = 'Please paste some code into the text area to begin analysis.';
            $scope.analysisResult = null; // Clear any previous results
            return;
        }

        $scope.analyzing = true; // Set analyzing flag to true
        $scope.message = 'Analyzing your code... Please wait.';
        $scope.analysisResult = null; // Clear previous results immediately

        // Make an HTTP POST request to the backend API endpoint
        $http.post('/api/analyze', { code: $scope.codeToAnalyze })
            .then(function(response) {
                // The backend (server.js) sends a JSON object in response.data
                // This object should directly contain score, metrics (including time/space complexity), and issues.
                $scope.analysisResult = response.data;

                // Determine the CSS class and status text based on the score.
                if ($scope.analysisResult.score >= 80) {
                    $scope.analysisResult.overallScoreClass = 'excellent';
                    $scope.analysisResult.status = 'Excellent';
                } else if ($scope.analysisResult.score >= 50) {
                    $scope.analysisResult.overallScoreClass = 'needs-improvement';
                    $scope.analysisResult.status = 'Needs Improvement';
                } else {
                    $scope.analysisResult.overallScoreClass = 'poor-quality';
                    $scope.analysisResult.status = 'Poor Quality';
                }

                $scope.message = 'Analysis complete!';
            })
            .catch(function(error) {
                console.error('Error during code analysis:', error);
                // Display a more specific error message from the backend if available
                $scope.message = error.data && error.data.message ? error.data.message : 'An error occurred during analysis. Please try again.';
                $scope.analysisResult = null; // Clear results on error
            })
            .finally(function() {
                $scope.analyzing = false; // Reset analyzing flag regardless of success or failure
            });
    };
}]);