SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('a', 'tst', 'jkn', 'test_products', 'test_loans');

