-- Runs once on first container start. The test suite needs an isolated
-- database it can truncate freely.
CREATE DATABASE pharmassist_test OWNER pharmassist;
