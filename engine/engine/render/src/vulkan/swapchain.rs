// Vulkan Swapchain - Explicit Format, No Driver Guessing
// Part of The Forge Doctrine: Truth Over Simulation

use ash::vk;
use crate::error::{RenderError, Result};

pub struct Swapchain {
    pub swapchain: ash::Swapchain,
    pub images: Vec<vk::Image>,
    pub image_views: Vec<vk::ImageView>,
    pub format: vk::Format,
    pub extent: vk::Extent2D,
}

impl Swapchain {
    /// Create swapchain with explicit format requirements
    pub fn create(
        device: &ash::Device,
        surface: &ash::khr::Surface,
        physical_device: vk::PhysicalDevice,
        surface_khr: vk::SurfaceKHR,
        width: u32,
        height: u32,
    ) -> Result<Self> {
        // Get surface capabilities (explicit query, no assumptions)
        let caps = unsafe { surface.get_physical_device_surface_capabilities(physical_device, surface_khr) }
            .map_err(|e| RenderError::SwapchainInit(format!("Get capabilities: {:?}", e)))?;

        // Get surface formats (explicit selection)
        let formats = unsafe { surface.get_physical_device_surface_formats(physical_device, surface_khr) }
            .map_err(|e| RenderError::SwapchainInit(format!("Get formats: {:?}", e)))?;

        // Prefer SRGB, fallback to first available
        let format = formats
            .iter()
            .find(|f| f.format == vk::Format::B8G8R8A8_SRGB)
            .or(formats.first())
            .ok_or_else(|| RenderError::SwapchainInit("No surface formats".into()))?;

        // Triple buffering (explicit count)
        let image_count = (caps.min_image_count + 2).min(caps.max_image_count.unwrap_or(3));

        let extent = vk::Extent2D { width, height };

        let create_info = vk::SwapchainCreateInfoKHR::builder()
            .surface(surface_khr)
            .min_image_count(image_count)
            .image_format(format.format)
            .image_color_space(format.color_space)
            .image_extent(extent)
            .image_array_layers(1)
            .image_usage(vk::ImageUsageFlags::COLOR_ATTACHMENT | vk::ImageUsageFlags::TRANSFER_DST)
            .pre_transform(caps.current_transform)
            .composite_alpha(vk::CompositeAlphaFlagsKHR::OPAQUE)
            .present_mode(vk::PresentModeKHR::MAILBOX) // Prefer mailbox, fallback if needed
            .clipped(true);

        let swapchain_loader = ash::khr::Swapchain::new(device, surface);
        let swapchain = unsafe { swapchain_loader.create_swapchain(&create_info, None) }
            .map_err(|e| RenderError::SwapchainInit(format!("Swapchain creation: {:?}", e)))?;

        let images = unsafe { swapchain_loader.get_swapchain_images(swapchain) }
            .map_err(|e| RenderError::SwapchainInit(format!("Get images: {:?}", e)))?;

        // Create image views (explicit, no magic)
        let mut image_views = Vec::new();
        for image in &images {
            let view_info = vk::ImageViewCreateInfo::builder()
                .image(*image)
                .view_type(vk::ImageViewType::TYPE_2D)
                .format(format.format)
                .components(vk::ComponentMapping::default())
                .subresource_range(vk::ImageSubresourceRange {
                    aspect_mask: vk::ImageAspectFlags::COLOR,
                    base_mip_level: 0,
                    level_count: 1,
                    base_array_layer: 0,
                    layer_count: 1,
                });

            let view = unsafe { device.create_image_view(&view_info, None) }
                .map_err(|e| RenderError::SwapchainInit(format!("Create image view: {:?}", e)))?;
            image_views.push(view);
        }

        Ok(Self {
            swapchain,
            images,
            image_views,
            format: format.format,
            extent,
        })
    }
}
