// Render Graph - Explicit Barriers, No Driver Heuristics
// Part of The Forge Doctrine: Control Over Convenience

use ash::vk;
use std::collections::HashMap;

pub type ResourceHandle = u32;
pub type PassID = u32;

#[derive(Debug, Clone)]
pub struct RGResource {
    pub image: vk::Image,
    pub layout: vk::ImageLayout,
    pub access: vk::AccessFlags2,
    pub stage: vk::PipelineStageFlags2,
}

#[derive(Debug, Clone)]
pub struct RGPass {
    pub id: PassID,
    pub pipeline: vk::Pipeline,
    pub reads: Vec<ResourceHandle>,
    pub writes: Vec<ResourceHandle>,
    pub execute: fn(vk::CommandBuffer),
}

pub struct RenderGraph {
    resources: HashMap<ResourceHandle, RGResource>,
    passes: Vec<RGPass>,
    execution_order: Vec<PassID>,
}

impl RenderGraph {
    pub fn new() -> Self {
        Self {
            resources: HashMap::new(),
            passes: Vec::new(),
            execution_order: Vec::new(),
        }
    }

    /// Register a resource with explicit state
    pub fn register_resource(&mut self, handle: ResourceHandle, resource: RGResource) {
        self.resources.insert(handle, resource);
    }

    /// Add a render pass with explicit dependencies
    pub fn add_pass(&mut self, pass: RGPass) {
        self.passes.push(pass);
    }

    /// Resolve execution order and barriers (explicit, no guessing)
    pub fn resolve(&mut self) -> Vec<Barrier> {
        let mut barriers = Vec::new();
        let mut resource_states = self.resources.clone();

        // Build dependency graph
        for pass in &self.passes {
            // Transition resources for reads
            for &read_handle in &pass.reads {
                if let Some(resource) = resource_states.get_mut(&read_handle) {
                    let new_layout = vk::ImageLayout::SHADER_READ_ONLY_OPTIMAL;
                    let new_access = vk::AccessFlags2::SHADER_READ;
                    let new_stage = vk::PipelineStageFlags2::FRAGMENT_SHADER;

                    if resource.layout != new_layout {
                        barriers.push(Barrier {
                            resource: read_handle,
                            old_layout: resource.layout,
                            new_layout,
                            old_access: resource.access,
                            new_access,
                            old_stage: resource.stage,
                            new_stage,
                        });

                        resource.layout = new_layout;
                        resource.access = new_access;
                        resource.stage = new_stage;
                    }
                }
            }

            // Transition resources for writes
            for &write_handle in &pass.writes {
                if let Some(resource) = resource_states.get_mut(&write_handle) {
                    let new_layout = vk::ImageLayout::COLOR_ATTACHMENT_OPTIMAL;
                    let new_access = vk::AccessFlags2::COLOR_ATTACHMENT_WRITE;
                    let new_stage = vk::PipelineStageFlags2::COLOR_ATTACHMENT_OUTPUT;

                    if resource.layout != new_layout {
                        barriers.push(Barrier {
                            resource: write_handle,
                            old_layout: resource.layout,
                            new_layout,
                            old_access: resource.access,
                            new_access,
                            old_stage: resource.stage,
                            new_stage,
                        });

                        resource.layout = new_layout;
                        resource.access = new_access;
                        resource.stage = new_stage;
                    }
                }
            }
        }

        barriers
    }

    /// Execute the render graph (one frame, explicit order)
    pub fn execute(&self, cmd: vk::CommandBuffer, barriers: &[Barrier]) {
        // Insert all barriers first (explicit sync)
        for barrier in barriers {
            let image_barrier = vk::ImageMemoryBarrier2::builder()
                .old_layout(barrier.old_layout)
                .new_layout(barrier.new_layout)
                .src_access_mask(barrier.old_access)
                .dst_access_mask(barrier.new_access)
                .src_stage_mask(barrier.old_stage)
                .dst_stage_mask(barrier.new_stage)
                .image(self.resources[&barrier.resource].image);

            let dep_info = vk::DependencyInfo::builder()
                .image_memory_barriers(std::slice::from_ref(&image_barrier));

            // Barrier insertion would use VK_KHR_synchronization2
            // vkCmdPipelineBarrier2(cmd, &dep_info);
            // For now, this is the structure - actual barrier insertion requires
            // proper Vulkan synchronization2 extension setup
        }

        // Execute passes in order
        for pass in &self.passes {
            // vkCmdBindPipeline(cmd, vk::PipelineBindPoint::GRAPHICS, pass.pipeline);
            (pass.execute)(cmd);
        }
    }
}

#[derive(Debug, Clone)]
pub struct Barrier {
    pub resource: ResourceHandle,
    pub old_layout: vk::ImageLayout,
    pub new_layout: vk::ImageLayout,
    pub old_access: vk::AccessFlags2,
    pub new_access: vk::AccessFlags2,
    pub old_stage: vk::PipelineStageFlags2,
    pub new_stage: vk::PipelineStageFlags2,
}
