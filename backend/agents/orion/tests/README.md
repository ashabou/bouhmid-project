# Orion Forecasting Agent - Test Suite

Comprehensive unit tests for the Orion demand forecasting service.

## Test Coverage

### Forecasting Models
- **test_sarima_model.py**: SARIMA time series forecasting
- **test_prophet_model.py**: Facebook Prophet forecasting
- **test_ensemble_model.py**: Ensemble model combining SARIMA and Prophet

### Services
- **test_forecaster.py**: Main forecasting orchestration service
- **test_insights_generator.py**: Business insights generation

### Test Fixtures
- **conftest.py**: Shared fixtures and test configuration
  - Sample sales data generation
  - Database session management
  - Mock data creation

## Running Tests

### Run all tests
```bash
pytest
```

### Run specific test file
```bash
pytest tests/test_sarima_model.py
```

### Run specific test class
```bash
pytest tests/test_sarima_model.py::TestSARIMAModel
```

### Run specific test
```bash
pytest tests/test_sarima_model.py::TestSARIMAModel::test_model_initialization
```

### Run with coverage report
```bash
pytest --cov=app --cov-report=html
```

### Run tests by marker
```bash
# Run only unit tests
pytest -m unit

# Run only slow tests
pytest -m slow

# Run model tests
pytest -m model
```

### Run tests in parallel (faster)
```bash
pip install pytest-xdist
pytest -n auto
```

## Test Categories

### Unit Tests
Test individual components in isolation:
- Model initialization
- Training and prediction
- Metrics calculation
- Data transformation

### Integration Tests
Test component interactions:
- Database operations
- Service orchestration
- End-to-end workflows

### Performance Tests
Test performance characteristics:
- Large dataset handling
- Training time
- Prediction speed

## Coverage Goals

- **Minimum**: 70% code coverage (enforced by pytest.ini)
- **Target**: 85% code coverage
- **Critical paths**: 100% coverage for core forecasting logic

## Test Data

Tests use realistic synthetic data:
- **Sales history**: 400 days of daily sales with trend and seasonality
- **Forecasts**: 30-day predictions with confidence intervals
- **Insights**: Various insight types and severity levels

All test data is generated deterministically (seed=42) for reproducibility.

## Continuous Integration

Tests run automatically on:
- Every commit (pre-commit hook)
- Pull requests (GitHub Actions)
- Daily scheduled runs (nightly builds)

## Writing New Tests

### Test Structure
```python
class TestNewFeature:
    """Test suite for new feature"""

    def test_basic_functionality(self):
        """Test basic use case"""
        # Arrange
        model = NewModel()

        # Act
        result = model.do_something()

        # Assert
        assert result is not None
```

### Using Fixtures
```python
def test_with_database(db_session, sales_history_records):
    """Test using database fixture"""
    # db_session provides clean database
    # sales_history_records provides sample data
    assert len(sales_history_records) > 0
```

### Mocking External Services
```python
from unittest.mock import Mock, patch

def test_with_mock():
    """Test with mocked external service"""
    with patch('app.external.service') as mock_service:
        mock_service.return_value = {'status': 'success'}
        # Test code here
```

## Troubleshooting

### Tests failing with database errors
- Ensure SQLite is available (used for in-memory test database)
- Check that all migrations are up to date

### Tests failing with import errors
- Install test dependencies: `pip install -r requirements.txt`
- Verify PYTHONPATH includes the app directory

### Slow test execution
- Use pytest-xdist for parallel execution
- Mark slow tests with `@pytest.mark.slow` and exclude them for quick runs

### Coverage not generating
- Ensure pytest-cov is installed
- Check pytest.ini configuration
- Run with explicit coverage flags: `pytest --cov=app`

## Best Practices

1. **Test naming**: Use descriptive names that explain what is being tested
2. **One assertion per test**: Focus each test on a single behavior
3. **Arrange-Act-Assert**: Follow AAA pattern for clarity
4. **Fixtures over setup**: Use pytest fixtures instead of setUp/tearDown
5. **Mock external dependencies**: Isolate unit tests from external services
6. **Test edge cases**: Include tests for error conditions and boundary values
7. **Keep tests fast**: Unit tests should run in milliseconds
8. **Document complex tests**: Add docstrings explaining non-obvious test logic

## Resources

- [pytest documentation](https://docs.pytest.org/)
- [pytest-cov documentation](https://pytest-cov.readthedocs.io/)
- [Testing best practices](https://docs.python-guide.org/writing/tests/)
