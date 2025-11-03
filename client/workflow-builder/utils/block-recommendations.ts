/**
 * Block Recommendation Engine
 * Provides intelligent suggestions for the next logical block based on the current block type
 */

export interface BlockRecommendation {
  blockType: string
  label: string
  category: string
  reason: string
  priority: number // 1 = highest priority
}

/**
 * Get recommended next blocks based on the current block type
 */
export function getBlockRecommendations(
  currentBlockLabel: string
): BlockRecommendation[] {
  const recommendations: BlockRecommendation[] = []

  switch (currentBlockLabel) {
    // Database query blocks
    case 'db.find':
      recommendations.push(
        {
          blockType: 'match',
          label: 'match',
          category: 'Conditions',
          reason: 'Check if query returned results',
          priority: 1,
        },
        {
          blockType: 'notify.toast',
          label: 'notify.toast',
          category: 'Actions',
          reason: 'Show success/error message',
          priority: 2,
        }
      )
      break

    // HTTP request blocks
    case 'http.request':
      recommendations.push(
        {
          blockType: 'match',
          label: 'match',
          category: 'Conditions',
          reason: 'Check HTTP response status',
          priority: 1,
        },
        {
          blockType: 'notify.toast',
          label: 'notify.toast',
          category: 'Actions',
          reason: 'Show request result to user',
          priority: 2,
        }
      )
      break

    // Form submission triggers
    case 'onSubmit':
      recommendations.push(
        {
          blockType: 'isFilled',
          label: 'isFilled',
          category: 'Conditions',
          reason: 'Validate required fields',
          priority: 1,
        },
        {
          blockType: 'dateValid',
          label: 'dateValid',
          category: 'Conditions',
          reason: 'Validate date fields',
          priority: 2,
        },
        {
          blockType: 'db.create',
          label: 'db.create',
          category: 'Actions',
          reason: 'Save form data to database',
          priority: 3,
        }
      )
      break

    // Database create/update blocks
    case 'db.create':
    case 'db.update':
      recommendations.push(
        {
          blockType: 'notify.toast',
          label: 'notify.toast',
          category: 'Actions',
          reason: 'Show success confirmation',
          priority: 1,
        },
        {
          blockType: 'page.redirect',
          label: 'page.redirect',
          category: 'Actions',
          reason: 'Navigate to another page',
          priority: 2,
        }
      )
      break

    // Page load triggers
    case 'onPageLoad':
      recommendations.push(
        {
          blockType: 'auth.verify',
          label: 'auth.verify',
          category: 'Actions',
          reason: 'Check user authentication',
          priority: 1,
        },
        {
          blockType: 'db.find',
          label: 'db.find',
          category: 'Actions',
          reason: 'Load page data from database',
          priority: 2,
        }
      )
      break

    // Click triggers
    case 'onClick':
      recommendations.push(
        {
          blockType: 'page.redirect',
          label: 'page.redirect',
          category: 'Actions',
          reason: 'Navigate to another page',
          priority: 1,
        },
        {
          blockType: 'ui.openModal',
          label: 'ui.openModal',
          category: 'Actions',
          reason: 'Show modal dialog',
          priority: 2,
        },
        {
          blockType: 'db.create',
          label: 'db.create',
          category: 'Actions',
          reason: 'Create database record',
          priority: 3,
        }
      )
      break

    // Login triggers
    case 'onLogin':
      recommendations.push(
        {
          blockType: 'page.redirect',
          label: 'page.redirect',
          category: 'Actions',
          reason: 'Redirect to dashboard/home',
          priority: 1,
        },
        {
          blockType: 'db.find',
          label: 'db.find',
          category: 'Actions',
          reason: 'Load user profile data',
          priority: 2,
        }
      )
      break

    // Validation blocks
    case 'isFilled':
    case 'dateValid':
      recommendations.push(
        {
          blockType: 'notify.toast',
          label: 'notify.toast',
          category: 'Actions',
          reason: 'Show validation error message',
          priority: 1,
        },
        {
          blockType: 'db.create',
          label: 'db.create',
          category: 'Actions',
          reason: 'Save validated data',
          priority: 2,
        }
      )
      break

    // Condition blocks
    case 'match':
    case 'roleIs':
      recommendations.push(
        {
          blockType: 'page.redirect',
          label: 'page.redirect',
          category: 'Actions',
          reason: 'Navigate based on condition',
          priority: 1,
        },
        {
          blockType: 'notify.toast',
          label: 'notify.toast',
          category: 'Actions',
          reason: 'Show conditional message',
          priority: 2,
        }
      )
      break

    // Email send
    case 'email.send':
      recommendations.push(
        {
          blockType: 'notify.toast',
          label: 'notify.toast',
          category: 'Actions',
          reason: 'Confirm email sent',
          priority: 1,
        }
      )
      break

    // Expression evaluation
    case 'expr':
      recommendations.push(
        {
          blockType: 'match',
          label: 'match',
          category: 'Conditions',
          reason: 'Check expression result',
          priority: 1,
        },
        {
          blockType: 'db.update',
          label: 'db.update',
          category: 'Actions',
          reason: 'Save calculated value',
          priority: 2,
        }
      )
      break

    // Record triggers
    case 'onRecordCreate':
    case 'onRecordUpdate':
      recommendations.push(
        {
          blockType: 'email.send',
          label: 'email.send',
          category: 'Actions',
          reason: 'Send notification email',
          priority: 1,
        },
        {
          blockType: 'notify.toast',
          label: 'notify.toast',
          category: 'Actions',
          reason: 'Show update notification',
          priority: 2,
        }
      )
      break

    // File upload
    case 'onDrop':
      recommendations.push(
        {
          blockType: 'db.create',
          label: 'db.create',
          category: 'Actions',
          reason: 'Save file metadata to database',
          priority: 1,
        },
        {
          blockType: 'notify.toast',
          label: 'notify.toast',
          category: 'Actions',
          reason: 'Confirm file uploaded',
          priority: 2,
        }
      )
      break

    default:
      // No specific recommendations for this block type
      break
  }

  return recommendations.sort((a, b) => a.priority - b.priority)
}

/**
 * Check if a recommendation should be shown based on existing blocks
 * (Avoid suggesting blocks that are already added)
 */
export function shouldShowRecommendation(
  recommendation: BlockRecommendation,
  existingBlockLabels: string[]
): boolean {
  // Don't show if the recommended block is already in the workflow
  return !existingBlockLabels.includes(recommendation.label)
}

