const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @route   POST /api/simple-forms/submit
 * @desc    Submit form data directly to database (simplified approach)
 * @access  Private
 */
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const { appId, formGroupId, formData, formName } = req.body;
    const userId = req.user.id;

    console.log('📝 [SIMPLE-FORM] Form submission received:', {
      appId,
      formGroupId,
      formName,
      fieldCount: Object.keys(formData || {}).length
    });

    // Verify user has access to this app
    const app = await prisma.app.findFirst({
      where: {
        id: parseInt(appId),
        ownerId: userId
      }
    });

    if (!app) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this app'
      });
    }

    // Validate form data
    if (!formData || Object.keys(formData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No form data provided'
      });
    }

    // Create a simple form submissions table if it doesn't exist
    const tableName = `app_${appId}_form_submissions`;
    
    // Check if table exists
    const tableExists = await checkTableExists(tableName);
    
    if (!tableExists) {
      console.log('🔨 [SIMPLE-FORM] Creating form submissions table:', tableName);
      await createFormSubmissionsTable(tableName, appId);
    }

    // Insert form data
    const submissionData = {
      form_group_id: formGroupId,
      form_name: formName || 'Unnamed Form',
      submission_data: JSON.stringify(formData),
      submitted_at: new Date(),
      app_id: parseInt(appId)
    };

    // Build dynamic insert based on form fields
    const columns = ['form_group_id', 'form_name', 'submission_data', 'submitted_at', 'app_id'];
    const values = ['$1', '$2', '$3', '$4', '$5'];
    const params = [formGroupId, formName || 'Unnamed Form', JSON.stringify(formData), new Date(), parseInt(appId)];

    // Add individual form fields as columns for easier querying
    let paramIndex = 6;
    for (const [fieldId, value] of Object.entries(formData)) {
      const columnName = `field_${fieldId.replace(/[^a-zA-Z0-9]/g, '_')}`;
      columns.push(`"${columnName}"`);
      values.push(`$${paramIndex}`);
      params.push(value);
      paramIndex++;
    }

    const insertSQL = `
      INSERT INTO "${tableName}" (${columns.join(', ')}) 
      VALUES (${values.join(', ')}) 
      RETURNING id
    `;

    console.log('💾 [SIMPLE-FORM] Inserting submission:', {
      tableName,
      columns: columns.length,
      params: params.length
    });

    const result = await prisma.$queryRawUnsafe(insertSQL, ...params);
    const submissionId = result[0]?.id;

    console.log('✅ [SIMPLE-FORM] Form submitted successfully:', {
      submissionId,
      tableName,
      formGroupId
    });

    res.json({
      success: true,
      message: 'Form submitted successfully',
      data: {
        submissionId,
        tableName,
        formGroupId
      }
    });

  } catch (error) {
    console.error('❌ [SIMPLE-FORM] Submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit form',
      error: error.message
    });
  }
});

/**
 * Check if a table exists in the database
 */
async function checkTableExists(tableName) {
  try {
    const result = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = $1
      )
    `, tableName);
    return result[0]?.exists || false;
  } catch (error) {
    console.error('Error checking table existence:', error);
    return false;
  }
}

/**
 * Create a simple form submissions table
 */
async function createFormSubmissionsTable(tableName, appId) {
  try {
    const createSQL = `
      CREATE TABLE "${tableName}" (
        id SERIAL PRIMARY KEY,
        form_group_id VARCHAR(255),
        form_name VARCHAR(255),
        submission_data JSONB,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        app_id INTEGER NOT NULL DEFAULT ${appId}
      )
    `;

    await prisma.$executeRawUnsafe(createSQL);

    // Create index for better performance
    await prisma.$executeRawUnsafe(`
      CREATE INDEX idx_${tableName}_app_id ON "${tableName}" (app_id)
    `);

    // Register table in UserTable for database page
    await prisma.userTable.create({
      data: {
        appId: parseInt(appId),
        tableName,
        columns: JSON.stringify([
          { name: 'id', type: 'SERIAL', required: true },
          { name: 'form_group_id', type: 'VARCHAR', required: false },
          { name: 'form_name', type: 'VARCHAR', required: false },
          { name: 'submission_data', type: 'JSONB', required: false },
          { name: 'submitted_at', type: 'TIMESTAMP', required: false },
          { name: 'app_id', type: 'INTEGER', required: true }
        ])
      }
    });

    console.log('✅ [SIMPLE-FORM] Table created and registered:', tableName);
  } catch (error) {
    console.error('❌ [SIMPLE-FORM] Table creation error:', error);
    throw error;
  }
}

/**
 * @route   GET /api/simple-forms/:appId/submissions
 * @desc    Get form submissions for an app
 * @access  Private
 */
router.get('/:appId/submissions', authenticateToken, async (req, res) => {
  try {
    const { appId } = req.params;
    const userId = req.user.id;

    // Verify access
    const app = await prisma.app.findFirst({
      where: {
        id: parseInt(appId),
        ownerId: userId
      }
    });

    if (!app) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const tableName = `app_${appId}_form_submissions`;
    const tableExists = await checkTableExists(tableName);

    if (!tableExists) {
      return res.json({
        success: true,
        data: [],
        message: 'No form submissions yet'
      });
    }

    // Get submissions
    const submissions = await prisma.$queryRawUnsafe(`
      SELECT * FROM "${tableName}" 
      ORDER BY submitted_at DESC 
      LIMIT 100
    `);

    res.json({
      success: true,
      data: submissions
    });

  } catch (error) {
    console.error('❌ [SIMPLE-FORM] Get submissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get submissions'
    });
  }
});

module.exports = router;
